"use client";

import { useCallback, useEffect, useId, useRef, useState, type FormEvent } from "react";
import { useAdmin } from "../AdminContext";
import { useDb } from "../DbContext";
import { AdminPage, DemoNote } from "../AdminPage";
import { AICopy, AIKey, AIMail } from "../AdminIcons";
import { initials } from "../AdminShell";
import { dataKey, usePersisted } from "@/lib/admin/storage";
import { ROLES, roleLabel, type Role } from "@/lib/team/roles";
import { changeRole, inviteMember, listTeam, removeMember, sendAccessLink, type TeamMember, type TeamResult } from "@/app/admin/team-actions";

type Load = { state: "loading" } | { state: "error"; message: string } | { state: "ready"; members: TeamMember[]; myRole: Role; emailReady: boolean };

const DEMO_ME: TeamMember = { userId: "demo-me", email: "tu-correo@ejemplo.com", name: "Tú (demo)", role: "owner", pending: false, lastSignIn: null, addedAt: "2026-11-01T12:00:00Z", invitedBy: null, isMe: true };

/** Equipo de la marca: del servidor (con Supabase) o, en la demo, de este navegador. */
function useTeam() {
  const db = useDb();
  const { bundle } = useAdmin();
  const [demoList, setDemoList] = usePersisted<TeamMember[]>(dataKey(bundle.tenant.slug, "team"), [DEMO_ME]);
  const [load, setLoad] = useState<Load>({ state: "loading" });
  const ready = db?.state.phase === "ready";

  const refresh = useCallback(async () => {
    if (!db) return;
    if (!ready) return;
    const r = await listTeam();
    setLoad(r.ok ? { state: "ready", members: r.members, myRole: r.myRole, emailReady: r.emailReady } : { state: "error", message: r.message });
  }, [db, ready]);

  useEffect(() => {
    const t = setTimeout(() => void refresh(), 0);
    return () => clearTimeout(t);
  }, [refresh]);

  if (!db) return { load: { state: "ready", members: demoList, myRole: "owner", emailReady: false } as Load, refresh, demo: true as const, setDemoList };
  return { load, refresh, demo: false as const, setDemoList };
}

const rtf = new Intl.RelativeTimeFormat("es-PE", { numeric: "auto" });
function ago(iso: string | null): string {
  if (!iso) return "Nunca";
  const s = (new Date(iso).getTime() - Date.now()) / 1000;
  const abs = Math.abs(s);
  if (abs < 60) return "Hace un momento";
  if (abs < 3600) return rtf.format(Math.round(s / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(s / 3600), "hour");
  if (abs < 2592000) return rtf.format(Math.round(s / 86400), "day");
  return new Date(iso).toLocaleDateString("es-PE", { day: "numeric", month: "short", year: "numeric" });
}

export function UsersView() {
  const { bundle, toast } = useAdmin();
  const brand = bundle.tenant.name;
  const { load, refresh, demo, setDemoList } = useTeam();
  const [inviting, setInviting] = useState(false);
  const [result, setResult] = useState<(TeamResult & { ok: true }) | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [removing, setRemoving] = useState<TeamMember | null>(null);

  const isOwner = load.state === "ready" && load.myRole === "owner";
  const members = load.state === "ready" ? load.members : [];
  const ownerCount = members.filter((m) => m.role === "owner").length;

  const run = async (key: string, fn: () => Promise<TeamResult>, after?: (r: TeamResult & { ok: true }) => void) => {
    setBusy(key);
    const r = await fn();
    setBusy(null);
    if (!r.ok) return toast(r.message);
    toast(r.message);
    after?.(r);
    await refresh();
  };

  const onRole = (m: TeamMember, role: Role) => {
    if (demo) {
      if (m.role === "owner" && role !== "owner" && ownerCount === 1) return toast("La marca necesita al menos un Dueño.");
      setDemoList((l) => l.map((x) => (x.userId === m.userId ? { ...x, role } : x)));
      return toast(`Perfil cambiado a ${roleLabel(role)}.`);
    }
    void run(`role-${m.userId}`, () => changeRole(m.userId, role));
  };

  const onLink = (m: TeamMember) => {
    if (demo) return toast(`Demo: aquí se enviaría el enlace a ${m.email}.`);
    void run(`link-${m.userId}`, () => sendAccessLink(m.userId), (r) => r.link && setResult(r));
  };

  const confirmRemove = async () => {
    const m = removing;
    if (!m) return;
    setRemoving(null);
    if (demo) {
      setDemoList((l) => l.filter((x) => x.userId !== m.userId));
      return toast(m.pending ? "Invitación cancelada." : "Acceso quitado.");
    }
    await run(`rm-${m.userId}`, () => removeMember(m.userId));
  };

  return (
    <AdminPage title="Usuarios">
      <div className="a-head">
        <div className="stack g1">
          <h1 className="a-h1">Usuarios</h1>
          <p className="a-sub">Quién entra al panel de {brand} y qué puede hacer cada persona.</p>
        </div>
        {isOwner && !inviting && (
          <button className="a-btn primary" type="button" onClick={() => { setInviting(true); setResult(null); }}>
            <AIMail size="sm" /> Invitar persona
          </button>
        )}
      </div>

      {load.state === "ready" && !isOwner && (
        <p className="a-banner info">Tu perfil es {roleLabel(load.myRole)}. Solo un Dueño de la marca puede invitar personas, cambiar perfiles o quitar accesos.</p>
      )}
      {load.state === "ready" && !demo && !load.emailReady && isOwner && (
        <p className="a-banner warn">
          Los correos salen con el remitente de prueba de Supabase, que tiene un límite por hora. Si una invitación no llega, copia el enlace y mándalo por WhatsApp. Para correos con el nombre de la marca, configura Resend (el mismo de las alertas de pedidos).
        </p>
      )}

      {inviting && (
        <InviteForm
          demo={demo}
          onCancel={() => setInviting(false)}
          onDone={(r, m) => {
            setInviting(false);
            setResult(r);
            if (demo && m) setDemoList((l) => [...l, m]);
            else void refresh();
          }}
        />
      )}

      {result && <ResultCard result={result} brand={brand} onClose={() => setResult(null)} />}

      <section className="a-card flush" aria-labelledby="team-h">
        <div className="a-card-h">
          <h2 className="a-h3" id="team-h">Equipo {load.state === "ready" && <span className="a-cap">· {members.length} {members.length === 1 ? "persona" : "personas"}</span>}</h2>
        </div>
        {load.state === "loading" && <p className="a-sub" style={{ padding: 20 }} role="status">Cargando el equipo…</p>}
        {load.state === "error" && <p className="a-banner err" style={{ margin: 16 }} role="alert">{load.message}</p>}
        {load.state === "ready" && (
          <div className="a-table" role="list">
            {members.map((m) => (
              <div className="a-tr usr-row" key={m.userId} role="listitem">
                <div className="row g3" style={{ minWidth: 0 }}>
                  <span className="a-me-av" aria-hidden="true">{initials(m.name || m.email)}</span>
                  <div className="stack g0" style={{ minWidth: 0 }}>
                    <b className="usr-name">
                      {m.name || m.email.split("@")[0]} {m.isMe && <span className="usr-me">Tú</span>}
                    </b>
                    <span className="a-cap usr-mail">{m.email}</span>
                  </div>
                </div>
                <div className="usr-role">
                  {isOwner ? (
                    <>
                      <label className="sr-only" htmlFor={`role-${m.userId}`}>Perfil de {m.email}</label>
                      <select
                        id={`role-${m.userId}`}
                        className="a-select"
                        value={m.role}
                        disabled={busy !== null || (m.role === "owner" && ownerCount === 1)}
                        title={m.role === "owner" && ownerCount === 1 ? "La marca necesita al menos un Dueño" : undefined}
                        onChange={(e) => onRole(m, e.target.value as Role)}
                      >
                        {ROLES.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
                      </select>
                    </>
                  ) : (
                    <span className="usr-badge">{roleLabel(m.role)}</span>
                  )}
                </div>
                <div className="stack g0 usr-status">
                  {m.pending ? <span className="st pend">Invitación pendiente</span> : <span className="st entregado">Activo</span>}
                  <span className="a-cap">{m.pending ? `Invitado ${ago(m.addedAt).toLowerCase()}${m.invitedBy ? ` por ${m.invitedBy}` : ""}` : `Último ingreso: ${ago(m.lastSignIn).toLowerCase()}`}</span>
                </div>
                {isOwner && (
                  <div className="row g2 usr-actions">
                    {!m.isMe && (
                      <button className="a-btn sm" type="button" disabled={busy !== null} onClick={() => onLink(m)}>
                        {m.pending ? <><AIMail size="sm" /> Reenviar invitación</> : <><AIKey size="sm" /> Enlace de contraseña</>}
                      </button>
                    )}
                    {!(m.role === "owner" && ownerCount === 1) && (
                      <button className="a-btn sm danger" type="button" disabled={busy !== null} onClick={() => setRemoving(m)}>
                        {m.pending ? "Cancelar invitación" : m.isMe ? "Salir del equipo" : "Quitar acceso"}
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      <RolesCard />

      <p className="a-cap">¿Olvidaste tu contraseña? Cada persona puede cambiarla desde <a href="/admin/perfil">Mi perfil</a> o con «¿Olvidaste tu contraseña?» en la pantalla de ingreso.</p>
      <DemoNote untilDb>Demo: la lista vive en este navegador y no se envían correos. Con la base conectada, las invitaciones llegan al correo de cada persona.</DemoNote>

      <ConfirmRemove member={removing} brand={brand} onCancel={() => setRemoving(null)} onConfirm={() => void confirmRemove()} />
    </AdminPage>
  );
}

function InviteForm({ demo, onCancel, onDone }: { demo: boolean; onCancel: () => void; onDone: (r: TeamResult & { ok: true }, demoMember?: TeamMember) => void }) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<Role>("staff");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const first = useRef<HTMLInputElement>(null);
  useEffect(() => first.current?.focus(), []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (demo) {
      const m: TeamMember = { userId: `demo-${Date.now()}`, email: email.trim().toLowerCase(), name: name.trim(), role, pending: true, lastSignIn: null, addedAt: new Date().toISOString(), invitedBy: "Tú (demo)", isMe: false };
      return onDone({ ok: true, emailed: false, message: `Demo: invitación lista para ${m.email}.`, link: `${window.location.origin}/admin/clave?demo=1`, warning: "En la demo no se envían correos." }, m);
    }
    setBusy(true);
    const r = await inviteMember({ email, name, role });
    setBusy(false);
    if (!r.ok) return setError(r.message);
    onDone(r);
  };

  return (
    <form className="a-card" onSubmit={submit} aria-labelledby="inv-h">
      <div className="stack g1">
        <h2 className="a-h2" id="inv-h">Invitar persona</h2>
        <p className="a-sub">Le llega un correo para crear su contraseña. Si ya tiene cuenta en otra marca, solo se le da acceso.</p>
      </div>
      <div className="a-grid2 usr-grid">
        <div className="a-field">
          <label htmlFor="inv-mail">Correo</label>
          <input ref={first} id="inv-mail" className="a-input" type="email" autoComplete="off" required placeholder="nombre@correo.com" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="a-field">
          <label htmlFor="inv-name">Nombre <span className="a-cap">(opcional)</span></label>
          <input id="inv-name" className="a-input" type="text" autoComplete="off" placeholder="Cómo se llama" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
      </div>
      <fieldset className="usr-roles">
        <legend className="a-field-legend">Perfil</legend>
        {ROLES.map((r) => (
          <label key={r.id} className={`usr-role-opt ${role === r.id ? "on" : ""}`}>
            <input type="radio" name="inv-role" value={r.id} checked={role === r.id} onChange={() => setRole(r.id)} />
            <span className="stack g0">
              <b>{r.label}</b>
              <span className="a-cap">{r.summary}</span>
            </span>
          </label>
        ))}
      </fieldset>
      {error && <p className="a-err" role="alert">{error}</p>}
      <div className="row g2">
        <button className="a-btn primary" type="submit" disabled={busy}>{busy ? "Enviando…" : "Enviar invitación"}</button>
        <button className="a-btn ghost" type="button" onClick={onCancel} disabled={busy}>Cancelar</button>
      </div>
    </form>
  );
}

function ResultCard({ result, brand, onClose }: { result: TeamResult & { ok: true }; brand: string; onClose: () => void }) {
  const { toast } = useAdmin();
  const id = useId();
  const copy = async () => {
    if (!result.link) return;
    try {
      await navigator.clipboard.writeText(result.link);
      toast("Enlace copiado");
    } catch {
      toast("No se pudo copiar: selecciona el enlace y cópialo a mano.");
    }
  };
  const wa = result.link ? `https://wa.me/?text=${encodeURIComponent(`Te di acceso al panel de ${brand}. Crea tu contraseña aquí: ${result.link}`)}` : null;
  return (
    <section className={`a-banner ${result.warning ? "warn" : "ok"} usr-result`} role="status" aria-live="polite">
      <div className="stack g2" style={{ flex: 1, minWidth: 0 }}>
        <b>{result.message}</b>
        {result.warning && <span>{result.warning}</span>}
        {result.link && (
          <>
            <label className="a-cap" htmlFor={id}>Enlace para crear la contraseña (sirve una vez y vence pronto)</label>
            <input id={id} className="a-input" readOnly value={result.link} onFocus={(e) => e.currentTarget.select()} />
            <div className="row g2 wrap-row">
              <button className="a-btn sm" type="button" onClick={() => void copy()}><AICopy size="sm" /> Copiar enlace</button>
              {wa && <a className="a-btn sm wa" href={wa} target="_blank" rel="noreferrer">Mandar por WhatsApp</a>}
            </div>
          </>
        )}
      </div>
      <button className="a-btn sm ghost" type="button" onClick={onClose}>Cerrar</button>
    </section>
  );
}

function RolesCard() {
  return (
    <section className="a-card" aria-labelledby="roles-h">
      <h2 className="a-h3" id="roles-h">Perfiles</h2>
      <div className="usr-roles-grid">
        {ROLES.map((r) => (
          <div key={r.id} className="usr-role-card">
            <b>{r.label}</b>
            <p className="a-cap">{r.summary}</p>
            <ul>
              {r.can.map((c) => <li key={c} className="ok">{c}</li>)}
              {r.cannot.map((c) => <li key={c} className="no">{c}</li>)}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

function ConfirmRemove({ member, brand, onCancel, onConfirm }: { member: TeamMember | null; brand: string; onCancel: () => void; onConfirm: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (member && !d.open) d.showModal();
    if (!member && d.open) d.close();
  }, [member]);
  const pending = member?.pending;
  return (
    <dialog ref={ref} className="a-dialog" style={{ width: "min(460px, calc(100vw - 24px))" }} aria-labelledby="rm-h" onCancel={onCancel} onClose={onCancel}>
      {member && (
        <div className="stack g4">
          <h2 className="a-h2" id="rm-h">{pending ? "¿Cancelar la invitación?" : member.isMe ? "¿Salir del equipo?" : "¿Quitar el acceso?"}</h2>
          <p className="a-sub">
            {pending
              ? `${member.email} ya no podrá usar el enlace de invitación.`
              : `${member.name || member.email} ya no podrá entrar al panel de ${brand}. Sus pedidos, ventas y cambios se quedan como están. Si después lo necesitas, lo vuelves a invitar.`}
          </p>
          <div className="row g2" style={{ justifyContent: "flex-end" }}>
            <button className="a-btn ghost" type="button" onClick={onCancel}>No, volver</button>
            <button className="a-btn danger" type="button" onClick={onConfirm}>{pending ? "Cancelar invitación" : member.isMe ? "Salir del equipo" : "Quitar acceso"}</button>
          </div>
        </div>
      )}
    </dialog>
  );
}
