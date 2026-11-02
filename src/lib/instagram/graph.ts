import { readFile } from "node:fs/promises";
import path from "node:path";

/**
 * Cliente mínimo de la API de Instagram con inicio de sesión de Instagram
 * (graph.instagram.com, permiso instagram_business_basic). No necesita página de Facebook.
 *
 * Con IG_MOCK=1 no llama a Meta: devuelve los posts de ejemplo de la marca
 * (src/tenants/<slug>/admin-demo.json) para probar todo el flujo en local.
 */

const VERSION = process.env.INSTAGRAM_API_VERSION || "v23.0";
const GRAPH = "https://graph.instagram.com";
export const IG_SCOPES = ["instagram_business_basic"];

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
  return igMock() || Boolean(process.env.INSTAGRAM_APP_ID && process.env.INSTAGRAM_APP_SECRET);
}

class IgError extends Error {
  constructor(message: string, readonly code?: number) {
    super(message);
  }
}
export { IgError };

async function call<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, cache: "no-store" });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.error) {
    const e = body.error ?? {};
    // 190 = token vencido o revocado: hay que volver a conectar la cuenta.
    throw new IgError(e.message || body.error_message || `Instagram respondió ${res.status}`, e.code ?? body.code);
  }
  return body as T;
}

/** Paso 1: a dónde mandar a la marca para que autorice. */
export function authorizeUrl(redirectUri: string, state: string): string {
  const q = new URLSearchParams({
    client_id: process.env.INSTAGRAM_APP_ID ?? "",
    redirect_uri: redirectUri,
    response_type: "code",
    scope: IG_SCOPES.join(","),
    state,
  });
  return `https://www.instagram.com/oauth/authorize?${q}`;
}

/** Paso 2: el código de la redirección → token corto → token de 60 días. */
export async function exchangeCode(code: string, redirectUri: string): Promise<{ token: string; expiresAt: Date; userId: string }> {
  const form = new URLSearchParams({
    client_id: process.env.INSTAGRAM_APP_ID ?? "",
    client_secret: process.env.INSTAGRAM_APP_SECRET ?? "",
    grant_type: "authorization_code",
    redirect_uri: redirectUri,
    code: code.replace(/#_$/, ""),
  });
  const short = await call<{ access_token: string; user_id: number | string }>("https://api.instagram.com/oauth/access_token", {
    method: "POST",
    body: form,
  });
  const q = new URLSearchParams({ grant_type: "ig_exchange_token", client_secret: process.env.INSTAGRAM_APP_SECRET ?? "", access_token: short.access_token });
  const long = await call<{ access_token: string; expires_in: number }>(`${GRAPH}/access_token?${q}`);
  return { token: long.access_token, expiresAt: new Date(Date.now() + long.expires_in * 1000), userId: String(short.user_id) };
}

/** Los tokens duran 60 días; se renuevan si tienen más de 24 h. */
export async function refreshToken(token: string): Promise<{ token: string; expiresAt: Date }> {
  if (igMock()) return { token, expiresAt: new Date(Date.now() + 60 * 864e5) };
  const q = new URLSearchParams({ grant_type: "ig_refresh_token", access_token: token });
  const r = await call<{ access_token: string; expires_in: number }>(`${GRAPH}/refresh_access_token?${q}`);
  return { token: r.access_token, expiresAt: new Date(Date.now() + r.expires_in * 1000) };
}

export async function fetchMe(token: string): Promise<{ userId: string; username: string; picture?: string }> {
  if (igMock()) return { userId: "mock", username: process.env.IG_MOCK_USERNAME || "cuenta.de.prueba" };
  const q = new URLSearchParams({ fields: "user_id,username,profile_picture_url", access_token: token });
  const me = await call<{ user_id: string; username: string; profile_picture_url?: string }>(`${GRAPH}/${VERSION}/me?${q}`);
  return { userId: String(me.user_id), username: me.username, picture: me.profile_picture_url };
}

const FIELDS = "id,caption,media_type,media_product_type,media_url,thumbnail_url,permalink,timestamp,children{id,media_type,media_url,thumbnail_url}";

/** Posts del feed, del más nuevo al más viejo. `limit` = cuántos como máximo (null = todos). */
export async function fetchMedia(token: string, limit: number | null, slug: string): Promise<IgMedia[]> {
  if (igMock()) return (await mockMedia(slug)).slice(0, limit ?? undefined);
  const out: IgMedia[] = [];
  let url: string | null = `${GRAPH}/${VERSION}/me/media?${new URLSearchParams({ fields: FIELDS, limit: "50", access_token: token })}`;
  while (url && (limit === null || out.length < limit)) {
    const page: { data: IgMedia[]; paging?: { next?: string } } = await call(url);
    out.push(...page.data);
    url = page.paging?.next ?? null;
  }
  return limit === null ? out : out.slice(0, limit);
}

/** Fotos de un post: las del carrusel, o la del post. De los videos/reels se guarda la portada. */
export function mediaImages(m: IgMedia): { id: string; url: string }[] {
  const pick = (x: { id: string; media_type: string; media_url?: string; thumbnail_url?: string }) => {
    const url = x.media_type === "VIDEO" ? x.thumbnail_url : x.media_url;
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
