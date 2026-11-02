import type { SupabaseClient } from "@supabase/supabase-js";
import { parseCaption } from "./caption";
import { download, fetchMedia, IgError, mediaImages, type IgMedia } from "./graph";

/**
 * Trae los posts de la cuenta conectada a la bandeja (ig_posts).
 *
 * Reglas:
 * - Las fotos se copian a nuestro storage (media/<slug>/ig/<id>.jpg); las de Meta vencen.
 * - Si un post ya es producto, se actualizan sus fotos de Instagram (ig_images) y, si la marca
 *   no las reemplazó por fotos propias (photos_synced), también las fotos que se ven en la tienda.
 * - El texto del producto solo se actualiza si nadie lo editó (sigue igual al caption anterior).
 * - Nunca se tocan nombre, precio, opciones, stock ni línea: eso es del equipo.
 * - Escaneo completo (una vez al día): los posts que ya no están en Instagram se marcan como borrados.
 */

export type SyncResult =
  | { ok: true; added: number; updated: number; removed: number; username: string }
  | { ok: false; reason: "not-connected" | "unknown-tenant" | "error"; message: string };

type PostRow = { id: string; ig_media_id: string; caption: string; ig_children: string[]; images: string[]; state: string; product_id: string | null; deleted_at: string | null };
type ProductRow = { id: string; ig_post_id: string; images: string[]; ig_images: string[]; photos_synced: boolean; description: string };

const RECENT = 25; // posts que se revisan en cada pasada corta
const same = (a: string[], b: string[]) => a.length === b.length && a.every((x, i) => x === b[i]);

export async function syncTenant(db: SupabaseClient, slug: string, opts: { full?: boolean } = {}): Promise<SyncResult> {
  const { data: tenant } = await db.from("tenants").select("id").eq("slug", slug).maybeSingle();
  if (!tenant) return { ok: false, reason: "unknown-tenant", message: `La marca «${slug}» no está en la base.` };
  const { data: acct } = await db.from("ig_accounts").select("*").eq("tenant_id", tenant.id).maybeSingle();
  if (!acct || acct.status === "disconnected") return { ok: false, reason: "not-connected", message: "No hay una cuenta de Instagram conectada." };

  try {
    // El token del sistema no vence (según la configuración de Meta); si la configuración le puso fecha, avisamos.
    if (acct.token_expires_at && new Date(acct.token_expires_at).getTime() < Date.now()) {
      throw new IgError("El acceso a Instagram venció.", 190);
    }

    const media = await fetchMedia(acct.access_token, acct.ig_user_id, opts.full ? null : RECENT, slug);
    const ids = media.map((m) => m.id);
    const [{ data: lines }, { data: posts }, { data: products }] = await Promise.all([
      db.from("product_lines").select("id, name").eq("tenant_id", tenant.id),
      db.from("ig_posts").select("id, ig_media_id, caption, ig_children, images, state, product_id, deleted_at").eq("tenant_id", tenant.id),
      db.from("products").select("id, ig_post_id, images, ig_images, photos_synced, description").eq("tenant_id", tenant.id).not("ig_post_id", "is", null),
    ]);
    const byMedia = new Map((posts as PostRow[] | null ?? []).map((p) => [p.ig_media_id, p]));
    const productOf = new Map((products as ProductRow[] | null ?? []).map((p) => [p.ig_post_id, p]));

    let added = 0;
    let updated = 0;
    for (const m of media) {
      const prev = byMedia.get(m.id);
      const product = productOf.get(m.id);
      const pics = mediaImages(m);
      const children = pics.map((p) => p.id);
      const caption = m.caption ?? "";
      const picsChanged = !prev || !same(children, prev.ig_children) || prev.images.length !== pics.length;
      const images = picsChanged ? await copyImages(db, slug, tenant.id, m, pics) : prev.images;
      const suggestion = parseCaption(caption, lines ?? []);
      const state = product ? "done" : prev ? (prev.state === "done" ? "new" : prev.state) : suggestion.kind;

      const row = {
        tenant_id: tenant.id,
        ig_media_id: m.id,
        media_type: m.media_type,
        product_type: m.media_product_type ?? null,
        permalink: m.permalink ?? null,
        caption,
        taken_at: m.timestamp ?? null,
        ig_children: children,
        images,
        state,
        suggestion,
        product_id: product?.id ?? null,
        deleted_at: null,
        synced_at: new Date().toISOString(),
      };
      if (!prev) added++;
      else if (picsChanged || prev.caption !== caption || prev.state !== state || prev.deleted_at) updated++;
      const { error } = await db.from("ig_posts").upsert(row, { onConflict: "tenant_id,ig_media_id" });
      if (error) throw new Error(error.message);

      if (product) {
        const patch: Partial<ProductRow> = {};
        if (!same(images, product.ig_images)) {
          patch.ig_images = images;
          if (product.photos_synced) patch.images = images;
        }
        if (prev && prev.caption !== caption && product.description.trim() === prev.caption.trim()) patch.description = caption;
        if (Object.keys(patch).length) await db.from("products").update(patch).eq("id", product.id);
      }
    }

    let removed = 0;
    if (opts.full) {
      const gone = (posts as PostRow[] | null ?? []).filter((p) => !p.deleted_at && !ids.includes(p.ig_media_id)).map((p) => p.id);
      if (gone.length) {
        await db.from("ig_posts").update({ deleted_at: new Date().toISOString() }).in("id", gone);
        removed = gone.length;
      }
    }

    const now = new Date().toISOString();
    await db
      .from("ig_accounts")
      .update({ status: "ok", last_error: null, last_sync_at: now, ...(opts.full ? { last_full_sync_at: now } : {}) })
      .eq("tenant_id", tenant.id);
    return { ok: true, added, updated, removed, username: acct.username };
  } catch (e) {
    const expired = e instanceof IgError && e.code === 190;
    const message = expired ? "Instagram pidió volver a conectar la cuenta." : e instanceof Error ? e.message : String(e);
    await db.from("ig_accounts").update({ status: "error", last_error: message }).eq("tenant_id", tenant.id);
    return { ok: false, reason: "error", message };
  }
}

/** Copia las fotos al bucket "media" y las registra en la biblioteca de Fotos (origin 'ig'). */
async function copyImages(db: SupabaseClient, slug: string, tenantId: string, m: IgMedia, pics: { id: string; url: string }[]): Promise<string[]> {
  const urls: string[] = [];
  const { data: known } = await db.from("media").select("ig_media_id").eq("tenant_id", tenantId).in("ig_media_id", pics.map((p) => p.id));
  const have = new Set((known ?? []).map((k) => k.ig_media_id));
  for (const [i, p] of pics.entries()) {
    const { bytes, type } = await download(p.url);
    const ext = type.includes("png") ? "png" : type.includes("webp") ? "webp" : "jpg";
    // Una ruta por foto de Meta: el contenido de una ruta nunca cambia (sin problemas de caché).
    const key = `${slug}/ig/${p.id}.${ext}`;
    const { error } = await db.storage.from("media").upload(key, bytes, { contentType: type, upsert: true, cacheControl: "31536000" });
    if (error) throw new Error(`Storage: ${error.message}`);
    const src = db.storage.from("media").getPublicUrl(key).data.publicUrl;
    urls.push(src);
    if (!have.has(p.id)) {
      const alt = (m.caption ?? "").split("\n")[0].slice(0, 120);
      await db.from("media").insert({ tenant_id: tenantId, src, origin: "ig", ig_media_id: p.id, alt: pics.length > 1 ? `${alt} (${i + 1})` : alt });
    }
  }
  return urls;
}
