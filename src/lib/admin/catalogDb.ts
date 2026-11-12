import type { SupabaseClient } from "@supabase/supabase-js";
import type { AdminCatalog, AdminProduct } from "./types";
import type { Line, Variant } from "@/lib/types";
import { minQty } from "@/lib/catalog";

/**
 * Catálogo del admin ↔ Supabase.
 * - products / product_variants / product_lines: lo que ve la tienda (RLS: el público solo ve lo no-borrador).
 * - catalog_private: costos y notas de líneas (solo el equipo).
 * Las variantes se guardan por (producto, key): así su id en la base (el que usa el checkout) no cambia al editar.
 */

type VariantRow = { id: string; key: string; label: string; price: number | string; price_is_reference: boolean; stock: number | null; image: string | null; position: number };
type ProductRow = {
  id: string; slug: string; name: string; line: string | null; badge: string | null;
  status: AdminProduct["status"]; kind: "simple" | "options"; options_label: string | null; description: string;
  images: string[]; position: number; ig_post_id: string | null; ig_images: string[]; photos_synced: boolean; extra: Record<string, unknown> | null;
  product_variants: VariantRow[];
};

type Extra = { lowAlert?: boolean; igSynced?: boolean; minQty?: number };

/** Fila de la base → producto editable. Sin stock en ninguna variante = «Sin control de stock». */
export function productFromRow(r: ProductRow): AdminProduct {
  const variants = [...r.product_variants].sort((a, b) => a.position - b.position);
  const tracked = !(variants.length && variants.every((v) => v.stock === null));
  const extra = (r.extra ?? {}) as Extra;
  return {
    id: r.slug,
    name: r.name,
    line: r.line ?? "",
    ...(r.badge ? { badge: r.badge } : {}),
    status: r.status,
    kind: r.kind,
    ...(r.options_label ? { optionsLabel: r.options_label } : {}),
    description: r.description,
    images: r.images ?? [],
    variants: variants.map(
      (v): Variant => ({
        id: v.key,
        dbId: v.id,
        label: v.label,
        price: Number(v.price),
        priceIsReference: v.price_is_reference,
        stock: v.stock ?? 0,
        ...(v.image ? { image: v.image } : {}),
      }),
    ),
    stockMode: tracked ? "stock" : "none",
    available: r.status !== "sold_out",
    lowAlert: extra.lowAlert !== false,
    igSynced: extra.igSynced ?? false,
    ...(Number(extra.minQty) > 1 ? { minQty: Number(extra.minQty) } : {}),
    ...(r.ig_post_id ? { igPostId: r.ig_post_id } : {}),
    igImages: r.ig_images ?? [],
    photosSynced: r.photos_synced,
  };
}

/** Estado que se guarda en la base. «Sin control de stock» + no disponible = agotado en la tienda. */
function storeStatus(p: AdminProduct): AdminProduct["status"] {
  if (p.status === "draft" || p.stockMode !== "none") return p.status;
  return p.available === false ? "sold_out" : "published";
}

function productRow(tenantId: string, p: AdminProduct, position: number) {
  const extra: Extra = { lowAlert: p.lowAlert !== false, igSynced: !!p.igSynced, ...(minQty(p) > 1 ? { minQty: minQty(p) } : {}) };
  return {
    tenant_id: tenantId,
    slug: p.id,
    name: p.name,
    line: p.line || null,
    badge: p.badge || null,
    status: storeStatus(p),
    kind: p.kind ?? (p.variants.length > 1 ? "options" : "simple"),
    options_label: p.optionsLabel || null,
    description: p.description ?? "",
    images: p.images,
    position,
    ig_post_id: p.igPostId ?? null,
    ig_images: p.igImages ?? [],
    photos_synced: p.photosSynced ?? true,
    extra,
    updated_at: new Date().toISOString(),
  };
}

function variantRows(tenantId: string, productId: string, p: AdminProduct) {
  const tracked = p.stockMode !== "none";
  return p.variants.map((v, i) => ({
    tenant_id: tenantId,
    product_id: productId,
    key: v.id,
    label: v.label,
    price: v.price,
    price_is_reference: v.priceIsReference,
    stock: tracked ? Math.max(0, Math.round(v.stock)) : null,
    image: v.image ?? null,
    position: i,
  }));
}

const PRODUCT_COLS =
  "id, slug, name, line, badge, status, kind, options_label, description, images, position, ig_post_id, ig_images, photos_synced, extra, product_variants(id, key, label, price, price_is_reference, stock, image, position)";

/** false si la tabla catalog_private aún no existe en la base (falta correr la migración 0002). */
let privateReady = true;
const missingTable = (e: { code?: string }) => e.code === "PGRST205" || e.code === "42P01";

export type DbCatalog = { catalog: AdminCatalog; ids: Record<string, string> };

/** Lee todo el catálogo de la marca, borradores incluidos (requiere sesión del equipo). */
export async function loadCatalog(client: SupabaseClient, tenantId: string): Promise<DbCatalog> {
  const [lines, products, priv] = await Promise.all([
    client.from("product_lines").select("id, name, position").eq("tenant_id", tenantId).order("position"),
    client.from("products").select(PRODUCT_COLS).eq("tenant_id", tenantId).order("position"),
    client.from("catalog_private").select("costs, line_notes").eq("tenant_id", tenantId).maybeSingle(),
  ]);
  for (const r of [lines, products]) if (r.error) throw new Error(r.error.message);
  // Sin la migración 0002 todavía no existe catalog_private: el catálogo funciona igual, sin costos ni notas guardadas.
  privateReady = !priv.error;
  if (priv.error && !missingTable(priv.error)) throw new Error(priv.error.message);
  const rows = (products.data ?? []) as ProductRow[];
  return {
    catalog: {
      lines: (lines.data ?? []).map((l): Line => ({ id: l.id, name: l.name, order: l.position })),
      products: rows.map(productFromRow),
      costs: (priv.data?.costs as AdminCatalog["costs"]) ?? {},
      lineNotes: (priv.data?.line_notes as AdminCatalog["lineNotes"]) ?? {},
    },
    ids: Object.fromEntries(rows.map((r) => [r.slug, r.id])),
  };
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
/** Para comparar productos sin los datos que pone la base. */
const plain = (p: AdminProduct) => ({ ...p, variants: p.variants.map((v) => ({ ...v, dbId: undefined })) });

function check<T extends { error: { message: string } | null }>(r: T): T {
  if (r.error) throw new Error(r.error.message);
  return r;
}

/**
 * Escribe en la base solo lo que cambió entre `prev` y `next`.
 * Devuelve los ids de producto actualizados (slug → uuid) y los ids de variantes nuevas.
 */
export async function saveCatalogDiff(
  client: SupabaseClient,
  tenantId: string,
  userId: string,
  prev: AdminCatalog,
  next: AdminCatalog,
  ids: Record<string, string>,
): Promise<{ ids: Record<string, string>; variantIds: Record<string, Record<string, string>> }> {
  const outIds = { ...ids };
  const variantIds: Record<string, Record<string, string>> = {};

  // Líneas
  const nextLineIds = new Set(next.lines.map((l) => l.id));
  const goneLines = prev.lines.filter((l) => !nextLineIds.has(l.id)).map((l) => l.id);
  const changedLines = next.lines
    .map((l, i) => ({ l, position: i + 1 }))
    .filter(({ l, position }) => {
      const old = prev.lines.find((x) => x.id === l.id);
      return !old || old.name !== l.name || prev.lines.indexOf(old) + 1 !== position;
    });
  if (changedLines.length)
    check(await client.from("product_lines").upsert(changedLines.map(({ l, position }) => ({ tenant_id: tenantId, id: l.id, name: l.name, position }))));

  // Productos borrados (sus variantes se borran en cascada)
  const nextSlugs = new Set(next.products.map((p) => p.id));
  const goneProducts = prev.products.filter((p) => !nextSlugs.has(p.id)).map((p) => p.id);
  if (goneProducts.length) {
    check(await client.from("products").delete().eq("tenant_id", tenantId).in("slug", goneProducts));
    goneProducts.forEach((s) => delete outIds[s]);
  }

  // Productos nuevos o cambiados (incluye cambio de posición)
  const prevIndex = new Map(prev.products.map((p, i) => [p.id, i]));
  for (const [i, p] of next.products.entries()) {
    const old = prev.products[prevIndex.get(p.id) ?? -1];
    if (old && prevIndex.get(p.id) === i && same(plain(old), plain(p))) continue;
    const { data } = check(await client.from("products").upsert(productRow(tenantId, p, i), { onConflict: "tenant_id,slug" }).select("id").single());
    const pid = (data as { id: string }).id;
    outIds[p.id] = pid;
    if (old && same(plain(old).variants, plain(p).variants) && old.stockMode === p.stockMode) continue;
    const keys = p.variants.map((v) => v.id);
    // Quitar opciones borradas antes de guardar el resto.
    const del = client.from("product_variants").delete().eq("product_id", pid);
    check(await (keys.length ? del.not("key", "in", `(${keys.map((k) => `"${k.replace(/"/g, '\\"')}"`).join(",")})`) : del));
    if (keys.length) {
      const { data: vs } = check(await client.from("product_variants").upsert(variantRows(tenantId, pid, p), { onConflict: "product_id,key" }).select("id, key"));
      variantIds[p.id] = Object.fromEntries(((vs ?? []) as { id: string; key: string }[]).map((v) => [v.key, v.id]));
    }
  }

  // Líneas borradas: al final, cuando sus productos ya se movieron o borraron.
  if (goneLines.length) check(await client.from("product_lines").delete().eq("tenant_id", tenantId).in("id", goneLines));

  // Costos y notas (privados)
  if (!same(prev.costs, next.costs) || !same(prev.lineNotes, next.lineNotes)) {
    if (!privateReady) throw new Error("los costos y notas necesitan la migración 0002_catalog_private en Supabase");
    check(
      await client.from("catalog_private").upsert({
        tenant_id: tenantId,
        costs: next.costs,
        line_notes: next.lineNotes,
        updated_at: new Date().toISOString(),
        updated_by: userId,
      }),
    );
  }

  return { ids: outIds, variantIds };
}
