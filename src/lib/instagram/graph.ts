import { createHmac } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

/**
 * Cliente mínimo de la API de Instagram con "Unified login" (inicio de sesión unificado).
 * Es lo único que Meta ofrece a las apps nuevas (desde fines de 2026):
 * - Login: diálogo de Facebook Login for Business con un `config_id` (los permisos vienen de la configuración).
 * - Token: token de usuario del sistema de la empresa de la marca (BISU). Según la configuración, no vence.
 * - API: graph.facebook.com con el id de la cuenta de Instagram. No hace falta página de Facebook.
 * Docs: https://developers.facebook.com/documentation/instagram-platform/instagram-api-with-unified-login/
 *
 * Con IG_MOCK=1 no llama a Meta: devuelve los posts de ejemplo de la marca
 * (src/tenants/<slug>/admin-demo.json) para probar todo el flujo en local.
 */

const VERSION = process.env.META_API_VERSION || "v26.0";
const GRAPH = `https://graph.facebook.com/${VERSION}`;
/**
 * Las variables se limpian: espacios, comillas o saltos de línea al pegar en Vercel rompen el login.
 * Los IDs aceptan también "client_id=123…" o la URL de inicio de sesión completa de Meta.
 */
const clean = (v: string | undefined) => (v ?? "").trim().replace(/^["']|["']$/g, "").trim();
function idFrom(v: string | undefined, key: "client_id" | "config_id"): string {
  const raw = clean(v);
  const inUrl = new RegExp(`${key}=(\\d+)`).exec(raw);
  if (inUrl) return inUrl[1];
  return /^[\d\s]+$/.test(raw) ? raw.replace(/\s/g, "") : raw;
}
const LOGIN_URL = () => clean(process.env.META_LOGIN_URL);
const APP_ID = () => idFrom(process.env.META_APP_ID || LOGIN_URL(), "client_id");
const APP_SECRET = () => clean(process.env.META_APP_SECRET);
const CONFIG_ID = () => idFrom(process.env.META_CONFIG_ID || LOGIN_URL(), "config_id");

export type IgChild = { id: string; media_type: string; media_url?: string; thumbnail_url?: string };
export type IgMedia = {
  id: string;
  caption?: string;
  media_type: "IMAGE" | "VIDEO" | "CAROUSEL_ALBUM";
  media_product_type?: "FEED" | "REELS" | "STORY" | "AD";
  media_url?: string;
  thumbnail_url?: string;
  permalink?: string;
  timestamp?: string;
  children?: { data: IgChild[] };
};

export const igMock = () => process.env.IG_MOCK === "1";

export function igConfigured(): boolean {
  return igMock() || Boolean(APP_ID() && APP_SECRET() && CONFIG_ID());
}

export class IgError extends Error {
  constructor(message: string, readonly code?: number) {
    super(message);
  }
}

/** Prueba de que la llamada viene del servidor de la app (recomendado por Meta). */
const proof = (token: string) => createHmac("sha256", APP_SECRET()).update(token).digest("hex");

async function call<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store" });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.error) {
    const e = body.error ?? {};
    // 190 = token vencido o revocado (p. ej. la marca quitó la app de su portfolio): hay que volver a conectar.
    throw new IgError(e.message || `Meta respondió ${res.status}`, e.code);
  }
  return body as T;
}

function api(pathname: string, token: string, params: Record<string, string> = {}): string {
  const q = new URLSearchParams({ ...params, access_token: token, appsecret_proof: proof(token) });
  return `${GRAPH}/${pathname}?${q}`;
}

/** Paso 1: a dónde mandar a la marca para que autorice (la redirección debe estar guardada en la configuración). */
export function authorizeUrl(redirectUri: string, state: string): string {
  const q = new URLSearchParams({
    client_id: APP_ID(),
    config_id: CONFIG_ID(),
    redirect_uri: redirectUri,
    response_type: "code",
    state,
  });
  return `https://www.facebook.com/dialog/oauth?${q}`; // formato exacto de la "URL de inicio de sesión" de Meta
}

/** Paso 2: el código de la redirección → token de la empresa de la marca. */
export async function exchangeCode(code: string, redirectUri: string): Promise<{ token: string; expiresAt: Date | null }> {
  const q = new URLSearchParams({ client_id: APP_ID(), client_secret: APP_SECRET(), redirect_uri: redirectUri, code });
  const r = await call<{ access_token: string; expires_in?: number }>(`${GRAPH}/oauth/access_token?${q}`);
  return { token: r.access_token, expiresAt: r.expires_in ? new Date(Date.now() + r.expires_in * 1000) : null };
}

export type IgAccountInfo = { userId: string; username: string; picture?: string };

/**
 * Cuentas de Instagram que la marca compartió con la app. Si hay varias, se queda la del handle
 * de la marca (`preferred`); si no coincide ninguna, la primera.
 */
export async function fetchAccount(token: string, preferred?: string): Promise<IgAccountInfo> {
  if (igMock()) return { userId: "mock", username: preferred || "cuenta.de.prueba" };
  const r = await call<{ data: { id: string; username: string }[] }>(api("me/assigned_instagram_accounts", token, { fields: "id,username" }));
  if (!r.data.length) throw new IgError("No se compartió ninguna cuenta de Instagram con la app.");
  const pick = r.data.find((a) => a.username.toLowerCase() === preferred?.toLowerCase()) ?? r.data[0];
  const info = await call<{ profile_picture_url?: string }>(api(pick.id, token, { fields: "profile_picture_url" })).catch(() => ({ profile_picture_url: undefined }));
  return { userId: pick.id, username: pick.username, picture: info.profile_picture_url };
}

const FIELDS = "id,caption,media_type,media_product_type,media_url,thumbnail_url,permalink,timestamp,children{id,media_type,media_url,thumbnail_url}";

/** Posts del feed, del más nuevo al más viejo. `limit` = cuántos como máximo (null = todos). */
export async function fetchMedia(token: string, igUserId: string, limit: number | null, slug: string): Promise<IgMedia[]> {
  if (igMock()) return (await mockMedia(slug)).slice(0, limit ?? undefined);
  const out: IgMedia[] = [];
  let url: string | null = api(`${igUserId}/media`, token, { fields: FIELDS, limit: String(Math.min(limit ?? 50, 50)) });
  while (url && (limit === null || out.length < limit)) {
    const page: { data: IgMedia[]; paging?: { next?: string } } = await call(url);
    out.push(...page.data);
    url = page.data.length ? page.paging?.next ?? null : null;
  }
  return limit === null ? out : out.slice(0, limit);
}

/** Fotos de un post: las del carrusel, o la del post. De los videos/reels se guarda la portada. */
export function mediaImages(m: IgMedia): { id: string; url: string }[] {
  const pick = (x: { id: string; media_type: string; media_url?: string; thumbnail_url?: string }) => {
    // media_url puede faltar (videos con música con derechos): se usa la portada.
    const url = x.media_type === "VIDEO" ? x.thumbnail_url ?? x.media_url : x.media_url ?? x.thumbnail_url;
    return url ? [{ id: x.id, url }] : [];
  };
  return m.media_type === "CAROUSEL_ALBUM" && m.children?.data.length ? m.children.data.flatMap(pick) : pick(m);
}

/** Baja una foto (las URLs de Instagram vencen, por eso se copian a nuestro storage). */
export async function download(url: string): Promise<{ bytes: Uint8Array; type: string }> {
  if (url.startsWith("file:")) {
    const file = url.slice(5);
    return { bytes: new Uint8Array(await readFile(file)), type: file.endsWith(".png") ? "image/png" : "image/jpeg" };
  }
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new IgError(`No se pudo bajar una foto (${res.status})`);
  return { bytes: new Uint8Array(await res.arrayBuffer()), type: res.headers.get("content-type") || "image/jpeg" };
}

// ───────── Modo de prueba ─────────
type DemoPost = { id: string; img: string; name: string; caption?: string; reel?: boolean };

async function mockMedia(slug: string): Promise<IgMedia[]> {
  const file = path.join(process.cwd(), "src/tenants", slug, "admin-demo.json");
  const demo = JSON.parse(await readFile(file, "utf8")) as { igPosts?: DemoPost[] };
  const day = 864e5;
  return (demo.igPosts ?? []).map((p, i) => {
    const url = `file:${path.join(process.cwd(), "public/tenants", slug, p.img)}`;
    return {
      id: `mock-${p.id}`,
      caption: p.caption ?? p.name,
      media_type: p.reel ? "VIDEO" : "IMAGE",
      media_product_type: p.reel ? "REELS" : "FEED",
      media_url: url,
      thumbnail_url: url,
      permalink: `https://www.instagram.com/p/mock-${p.id}/`,
      timestamp: new Date(Date.UTC(2026, 9, 31) - i * day).toISOString(),
    } satisfies IgMedia;
  });
}

/**
 * Diagnóstico para el admin (sin secretos): qué IDs se están usando y si Meta reconoce la app
 * con esa clave secreta (token de app = "<id>|<secret>").
 */
export async function checkSetup(redirectUri: string) {
  const appId = APP_ID();
  const configId = CONFIG_ID();
  let app: { ok: boolean; name?: string; error?: string };
  try {
    const r = await call<{ name?: string }>(`${GRAPH}/${encodeURIComponent(appId)}?fields=name&access_token=${encodeURIComponent(`${appId}|${APP_SECRET()}`)}`);
    app = { ok: true, name: r.name };
  } catch (e) {
    app = { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
  return {
    app_id: appId,
    app_id_is_number: /^\d+$/.test(appId),
    config_id: configId,
    config_id_is_number: /^\d+$/.test(configId),
    secret_set: APP_SECRET().length > 0,
    redirect_uri: redirectUri,
    meta_says: app,
  };
}
