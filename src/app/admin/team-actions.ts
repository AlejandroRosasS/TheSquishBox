"use server";

import { headers } from "next/headers";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { serverClient } from "@/lib/db/server";
import { dbConfigured } from "@/lib/db/env";
import { serviceClient, serviceConfigured } from "@/lib/db/service";
import { tenantSlug } from "@/lib/tenant";
import { isRole, roleLabel, type Role } from "@/lib/team/roles";
import { sendTeamEmail, teamEmailReady } from "@/lib/team/email";

/*
 * Usuarios y accesos del panel (Admin › Usuarios). Todo pasa por aquí, en el servidor:
 * tenant_members no tiene políticas de escritura y las cuentas se crean con la clave secreta.
 * Solo un Dueño de la marca invita, cambia perfiles, quita accesos y manda enlaces de contraseña.
 */

export type TeamMember = {
  userId: string;
  email: string;
  name: string;
  role: Role;
  /** Nunca entró: la invitación sigue pendiente. */
  pending: boolean;
  lastSignIn: string | null;
  addedAt: string;
  invitedBy: string | null;
  isMe: boolean;
};

export type TeamList =
  | { ok: true; members: TeamMember[]; myRole: Role; emailReady: boolean }
  | { ok: false; message: string };

/** Resultado de una acción que puede mandar un correo. `link`: enlace para compartir a mano (solo invitaciones nuevas). */
export type TeamResult =
  | { ok: true; message: string; emailed: boolean; link?: string; warning?: string }
  | { ok: false; message: string };

type Me = { user: User; tenantId: string; brand: string; role: Role };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const NOT_READY = "Falta configurar la base en el servidor (SUPABASE_SECRET_KEY).";

async function me(): Promise<Me | null> {
  if (!dbConfigured()) return null;
  const db = await serverClient();
  const { data: u } = await db.auth.getUser();
  if (!u.user) return null;
  const { data: t } = await db.from("tenants").select("id, name").eq("slug", tenantSlug()).maybeSingle();
  if (!t) return null;
  const { data: m } = await db.from("tenant_members").select("role").eq("tenant_id", t.id).eq("user_id", u.user.id).maybeSingle();
  if (!m || !isRole(m.role)) return null;
  return { user: u.user, tenantId: t.id as string, brand: t.name as string, role: m.role };
}

async function owner(): Promise<Me | { error: string }> {
  const m = await me();
  if (!m) return { error: "Inicia sesión con una cuenta del equipo." };
  if (m.role !== "owner") return { error: "Solo un Dueño de la marca puede cambiar los accesos." };
  if (!serviceConfigured()) return { error: NOT_READY };
  return m;
}

/** Dominio para los enlaces de los correos: SITE_URL si está, si no el de esta visita. */
async function origin(): Promise<string> {
  const site = process.env.SITE_URL?.trim();
  if (site) return site.replace(/\/+$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

const displayName = (u: User) => String(u.user_metadata?.full_name ?? u.user_metadata?.name ?? "").trim();
const who = (u: User) => displayName(u) || u.email || "Alguien del equipo";

/** Enlace a la página que valida el token y deja crear la contraseña. */
const passwordLink = (base: string, tokenHash: string, type: "invite" | "magiclink" | "recovery") =>
  `${base}/admin/clave?token_hash=${encodeURIComponent(tokenHash)}&type=${type}`;

async function otherTenants(db: SupabaseClient, userId: string, tenantId: string): Promise<number> {
  const { count } = await db.from("tenant_members").select("tenant_id", { count: "exact", head: true }).eq("user_id", userId).neq("tenant_id", tenantId);
  return count ?? 0;
}

async function owners(db: SupabaseClient, tenantId: string): Promise<string[]> {
  const { data } = await db.from("tenant_members").select("user_id").eq("tenant_id", tenantId).eq("role", "owner");
  return (data ?? []).map((r) => r.user_id as string);
}

// ─────────── Lista ───────────

export async function listTeam(): Promise<TeamList> {
  const m = await me();
  if (!m) return { ok: false, message: "Inicia sesión con una cuenta del equipo." };
  if (!serviceConfigured()) return { ok: false, message: NOT_READY };
  const db = serviceClient();
  const { data: rows, error } = await db.from("tenant_members").select("user_id, role, created_at").eq("tenant_id", m.tenantId).order("created_at");
  if (error) return { ok: false, message: error.message };
  // invited_by llega con la migración 0015; si aún no está, la lista funciona igual.
  const { data: inv } = await db.from("tenant_members").select("user_id, invited_by").eq("tenant_id", m.tenantId);
  const invitedBy = new Map((inv ?? []).map((r) => [r.user_id as string, (r.invited_by as string | null) ?? null]));

  const users = await Promise.all((rows ?? []).map((r) => db.auth.admin.getUserById(r.user_id as string).then((x) => x.data.user)));
  const byId = new Map(users.filter((u): u is User => !!u).map((u) => [u.id, u]));
  const members: TeamMember[] = (rows ?? []).map((r) => {
    const u = byId.get(r.user_id as string);
    const by = invitedBy.get(r.user_id as string);
    const inviter = by ? byId.get(by) : undefined;
    return {
      userId: r.user_id as string,
      email: u?.email ?? "(cuenta borrada)",
      name: u ? displayName(u) : "",
      role: isRole(r.role) ? r.role : "staff",
      pending: !u?.last_sign_in_at,
      lastSignIn: u?.last_sign_in_at ?? null,
      addedAt: r.created_at as string,
      invitedBy: inviter ? who(inviter) : null,
      isMe: r.user_id === m.user.id,
    };
  });
  return { ok: true, members, myRole: m.role, emailReady: teamEmailReady() };
}

// ─────────── Invitar ───────────

export async function inviteMember(input: { email: string; name: string; role: string }): Promise<TeamResult> {
  const m = await owner();
  if ("error" in m) return { ok: false, message: m.error };
  const email = input.email.trim().toLowerCase();
  const name = input.name.trim().slice(0, 80);
  if (!EMAIL_RE.test(email)) return { ok: false, message: "Revisa el correo: debe verse como nombre@dominio.com" };
  if (!isRole(input.role)) return { ok: false, message: "Elige un perfil." };
  const role = input.role;
  const db = serviceClient();
  const base = await origin();
  const inviter = who(m.user);
  const label = roleLabel(role);

  // 1) Cuenta nueva: se crea con un enlace de invitación.
  const created = await db.auth.admin.generateLink({ type: "invite", email, options: { data: name ? { full_name: name } : undefined, redirectTo: `${base}/admin/clave` } });
  let user: User | null = created.data.user ?? null;
  const isNew = !created.error && !!user;
  if (created.error && created.error.code !== "email_exists" && !/already been registered/i.test(created.error.message)) {
    return { ok: false, message: `No se pudo crear la cuenta: ${created.error.message}` };
  }

  // 2) Ya tiene cuenta (por ejemplo, en otra marca): solo se le da acceso.
  if (!user) {
    const link = await db.auth.admin.generateLink({ type: "magiclink", email });
    user = link.data.user ?? null;
    if (!user) return { ok: false, message: `No se encontró la cuenta: ${link.error?.message ?? "sin datos"}` };
  }

  const { data: already } = await db.from("tenant_members").select("role").eq("tenant_id", m.tenantId).eq("user_id", user.id).maybeSingle();
  if (already) return { ok: false, message: `${email} ya tiene acceso (perfil ${roleLabel(isRole(already.role) ? already.role : "staff")}).` };

  const row = { tenant_id: m.tenantId, user_id: user.id, role, invited_by: m.user.id };
  let ins = await db.from("tenant_members").insert(row);
  if (ins.error && /invited_by/.test(ins.error.message)) {
    // Sin la migración 0015 no existe invited_by (y solo se aceptan owner y staff).
    ins = await db.from("tenant_members").insert({ tenant_id: m.tenantId, user_id: user.id, role });
  }
  if (ins.error) {
    const hint = /role_check/.test(ins.error.message) ? " Falta aplicar la migración 0015 (perfiles)." : "";
    return { ok: false, message: `No se pudo dar el acceso: ${ins.error.message}.${hint}` };
  }

  if (isNew) {
    const url = passwordLink(base, created.data.properties!.hashed_token, "invite");
    if (!teamEmailReady()) {
      // Sin Resend: lo manda Supabase con su remitente (renueva el enlace). Si falla, queda el enlace para copiar.
      const sb = await db.auth.admin.inviteUserByEmail(email, { redirectTo: `${base}/admin/clave`, data: name ? { full_name: name } : undefined });
      if (!sb.error) return { ok: true, emailed: true, message: `Invitación enviada a ${email}.` };
      return { ok: true, emailed: false, link: url, message: `Le diste acceso a ${email}.`, warning: `El correo no salió (${sb.error.message}). Copia el enlace y mándaselo por WhatsApp.` };
    }
    const mail = await sendTeamEmail({
      to: email,
      brand: m.brand,
      subject: `Te invitaron al panel de ${m.brand}`,
      lines: [`${inviter} te dio acceso al panel de ${m.brand} con el perfil ${label}.`, "Toca el botón para crear tu contraseña y entrar."],
      button: "Crear mi contraseña",
      url,
      foot: "El enlace sirve una sola vez y vence pronto. Si vence, pide que te lo reenvíen desde el panel.",
    });
    if (mail.ok) return { ok: true, emailed: true, link: url, message: `Invitación enviada a ${email}.` };
    return {
      ok: true,
      emailed: false,
      link: url,
      message: `Le diste acceso a ${email}.`,
      warning: `El correo no salió (${mail.error}). Copia el enlace y mándaselo por WhatsApp.`,
    };
  }

  // Ya tenía cuenta: aviso por correo, sin enlace de ingreso (entra con su contraseña de siempre).
  const mail = await sendTeamEmail({
    to: email,
    brand: m.brand,
    subject: `Ya tienes acceso al panel de ${m.brand}`,
    lines: [`${inviter} te dio acceso al panel de ${m.brand} con el perfil ${label}.`, "Entra con tu correo y la contraseña que ya usas."],
    button: "Entrar al panel",
    url: `${base}/admin/login`,
    foot: "Si olvidaste tu contraseña, en la pantalla de ingreso toca «¿Olvidaste tu contraseña?».",
  });
  return {
    ok: true,
    emailed: mail.ok,
    message: `${email} ya tenía cuenta: ahora también entra a ${m.brand}.`,
    warning: mail.ok ? undefined : "No se mandó el aviso por correo; cuéntale que ya puede entrar con su contraseña de siempre.",
  };
}

// ─────────── Reenviar invitación / enlace de contraseña ───────────

export async function sendAccessLink(userId: string): Promise<TeamResult> {
  const m = await owner();
  if ("error" in m) return { ok: false, message: m.error };
  const db = serviceClient();
  const { data: mem } = await db.from("tenant_members").select("user_id").eq("tenant_id", m.tenantId).eq("user_id", userId).maybeSingle();
  if (!mem) return { ok: false, message: "Esa persona ya no está en el equipo." };
  const { data: got } = await db.auth.admin.getUserById(userId);
  const u = got.user;
  if (!u?.email) return { ok: false, message: "La cuenta no tiene correo." };
  const base = await origin();
  const pending = !u.last_sign_in_at;
  // Invitación sin confirmar: se renueva la invitación. Cuenta confirmada: enlace de ingreso o de contraseña nueva.
  const type = !u.email_confirmed_at ? "invite" : pending ? "magiclink" : "recovery";

  if (teamEmailReady()) {
    const link = await db.auth.admin.generateLink({ type, email: u.email });
    if (link.error || !link.data.properties) return { ok: false, message: `No se pudo crear el enlace: ${link.error?.message ?? "sin datos"}` };
    const url = passwordLink(base, link.data.properties.hashed_token, type);
    const mail = await sendTeamEmail({
      to: u.email,
      brand: m.brand,
      subject: pending ? `Tu invitación al panel de ${m.brand}` : `Cambia tu contraseña del panel de ${m.brand}`,
      lines: pending
        ? [`${who(m.user)} te reenvió la invitación al panel de ${m.brand}.`, "Toca el botón para crear tu contraseña y entrar."]
        : [`${who(m.user)} te mandó un enlace para crear una contraseña nueva del panel de ${m.brand}.`, "Si no lo pediste, puedes ignorar este correo: tu contraseña actual sigue funcionando."],
      button: pending ? "Crear mi contraseña" : "Crear contraseña nueva",
      url,
      foot: "El enlace sirve una sola vez y vence pronto.",
    });
    if (!mail.ok) return { ok: false, message: `El correo no salió: ${mail.error}` };
    // El enlace a mano solo para invitaciones pendientes de alguien que no está en otra marca.
    const shareable = pending && (await otherTenants(db, userId, m.tenantId)) === 0;
    return { ok: true, emailed: true, link: shareable ? url : undefined, message: `Enviamos el enlace a ${u.email}.` };
  }

  // Sin Resend: el correo lo manda Supabase (su remitente por defecto tiene límite por hora).
  const r = pending
    ? await db.auth.signInWithOtp({ email: u.email, options: { shouldCreateUser: false, emailRedirectTo: `${base}/admin/clave` } })
    : await db.auth.resetPasswordForEmail(u.email, { redirectTo: `${base}/admin/clave` });
  if (r.error) return { ok: false, message: `El correo no salió: ${r.error.message}` };
  return { ok: true, emailed: true, message: `Enviamos el enlace a ${u.email}.` };
}

// ─────────── Perfil ───────────

export async function changeRole(userId: string, role: string): Promise<TeamResult> {
  const m = await owner();
  if ("error" in m) return { ok: false, message: m.error };
  if (!isRole(role)) return { ok: false, message: "Perfil inválido." };
  const db = serviceClient();
  const list = await owners(db, m.tenantId);
  if (role !== "owner" && list.length === 1 && list[0] === userId) {
    return { ok: false, message: "La marca necesita al menos un Dueño. Nombra a otra persona como Dueño antes de cambiar este perfil." };
  }
  const { error, count } = await db.from("tenant_members").update({ role }, { count: "exact" }).eq("tenant_id", m.tenantId).eq("user_id", userId);
  if (error) {
    const hint = /role_check/.test(error.message) ? " Falta aplicar la migración 0015 (perfiles)." : "";
    return { ok: false, message: `No se pudo cambiar: ${error.message}.${hint}` };
  }
  if (!count) return { ok: false, message: "Esa persona ya no está en el equipo." };
  return { ok: true, emailed: false, message: `Perfil cambiado a ${roleLabel(role)}.` };
}

// ─────────── Quitar acceso ───────────

export async function removeMember(userId: string): Promise<TeamResult> {
  const m = await owner();
  if ("error" in m) return { ok: false, message: m.error };
  const db = serviceClient();
  const list = await owners(db, m.tenantId);
  if (list.length === 1 && list[0] === userId) return { ok: false, message: "No se puede quitar al único Dueño de la marca." };
  const { error } = await db.from("tenant_members").delete().eq("tenant_id", m.tenantId).eq("user_id", userId);
  if (error) return { ok: false, message: `No se pudo quitar: ${error.message}` };

  // Invitación que nunca se usó y sin otra marca: se borra la cuenta, así el enlace deja de servir.
  const { data: got } = await db.auth.admin.getUserById(userId);
  if (got.user && !got.user.last_sign_in_at && (await otherTenants(db, userId, m.tenantId)) === 0) {
    await db.auth.admin.deleteUser(userId);
    return { ok: true, emailed: false, message: "Invitación cancelada." };
  }
  return { ok: true, emailed: false, message: "Acceso quitado. Ya no puede entrar al panel de esta marca." };
}

// ─────────── «¿Olvidaste tu contraseña?» (pantalla de ingreso, sin sesión) ───────────

/**
 * Siempre responde lo mismo, exista o no la cuenta, para no revelar quién es del equipo.
 * `fallback`: el servidor no puede mandar correos; el navegador lo pide a Supabase directamente.
 */
export async function requestPasswordReset(rawEmail: string): Promise<{ ok: true; fallback?: boolean } | { ok: false; message: string }> {
  const email = rawEmail.trim().toLowerCase();
  if (!EMAIL_RE.test(email)) return { ok: false, message: "Revisa el correo: debe verse como nombre@dominio.com" };
  if (!dbConfigured() || !serviceConfigured() || !teamEmailReady()) return { ok: true, fallback: true };
  const db = serviceClient();
  const link = await db.auth.admin.generateLink({ type: "recovery", email });
  const u = link.data.user;
  if (link.error || !u || !link.data.properties) return { ok: true };
  const { data: t } = await db.from("tenants").select("id, name").eq("slug", tenantSlug()).maybeSingle();
  if (!t) return { ok: true };
  const { data: mem } = await db.from("tenant_members").select("user_id").eq("tenant_id", t.id).eq("user_id", u.id).maybeSingle();
  if (!mem) return { ok: true };
  const base = await origin();
  await sendTeamEmail(
    {
      to: email,
      brand: t.name as string,
      subject: `Cambia tu contraseña del panel de ${t.name}`,
      lines: [`Pediste cambiar tu contraseña del panel de ${t.name}.`, "Si no fuiste tú, ignora este correo: tu contraseña actual sigue funcionando."],
      button: "Crear contraseña nueva",
      url: passwordLink(base, link.data.properties.hashed_token, "recovery"),
      foot: "El enlace sirve una sola vez y vence pronto. Si pides otro, solo sirve el último.",
    },
  );
  return { ok: true };
}
