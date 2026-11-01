import type { Catalog, Product, Seo, Storefront, Tenant } from "@/lib/types";
import type { Tokens } from "@/lib/publishedTheme";
import { publicClient } from "./public";
import { UNTRACKED_STOCK } from "@/lib/catalog";

export type DbBundle = {
  tenant: Tenant;
  catalog: Catalog;
  storefront: Storefront;
  seo: Seo;
  appearance: { key: string | null; tokens: Tokens } | null;
};

type ProductRow = {
  id: string; slug: string; name: string; line: string | null; badge: string | null;
  status: Product["status"]; kind: "simple" | "options"; options_label: string | null; description: string; images: string[]; position: number; extra: Record<string, unknown>;
  product_variants: { id: string; key: string; label: string; price: number | string; price_is_reference: boolean; stock: number | null; image: string | null; position: number }[];
};

/**
 * Arma la marca desde Supabase con lo PUBLICADO.
 * Devuelve null si la marca no existe en la base (entonces se usan los JSON del repo).
 */
export async function loadBundleFromDb(slug: string): Promise<DbBundle | null> {
  const db = publicClient();
  const { data: t, error } = await db.from("tenants").select("id").eq("slug", slug).maybeSingle();
  if (error) throw new Error(`Supabase: ${error.message}`);
  if (!t) return null;

  const [docs, lines, products] = await Promise.all([
    db.from("site_docs").select("kind, body").eq("tenant_id", t.id).eq("stage", "published"),
    db.from("product_lines").select("id, name, position").eq("tenant_id", t.id).order("position"),
    db.from("products")
      .select("id, slug, name, line, badge, status, kind, options_label, description, images, position, extra, product_variants(id, key, label, price, price_is_reference, stock, image, position)")
      .eq("tenant_id", t.id)
      .neq("status", "draft")
      .order("position"),
  ]);
  for (const r of [docs, lines, products]) if (r.error) throw new Error(`Supabase: ${r.error.message}`);

  const doc = Object.fromEntries((docs.data ?? []).map((d) => [d.kind, d.body])) as Record<string, unknown>;
  const tenantDoc = doc.tenant as (Tenant & { catalogExtras?: Partial<Catalog> }) | undefined;
  if (!tenantDoc || !doc.storefront || !doc.seo) return null;

  const { catalogExtras, ...tenant } = tenantDoc;
  const catalog: Catalog = {
    ...catalogExtras,
    lines: (lines.data ?? []).map((l) => ({ id: l.id, name: l.name, order: l.position })),
    products: ((products.data ?? []) as ProductRow[]).map((p) => ({
      id: p.slug,
      name: p.name,
      line: p.line ?? "",
      ...(p.badge ? { badge: p.badge } : {}),
      status: p.status,
      kind: p.kind,
      ...(p.options_label ? { optionsLabel: p.options_label } : {}),
      description: p.description,
      images: p.images,
      // Sin stock en ninguna variante = la marca vende sin contar unidades.
      ...(p.product_variants.length && p.product_variants.every((v) => v.stock === null) ? { trackStock: false } : {}),
      variants: [...p.product_variants]
        .sort((a, b) => a.position - b.position)
        .map((v) => ({
          id: v.key,
          dbId: v.id,
          label: v.label,
          price: Number(v.price),
          priceIsReference: v.price_is_reference,
          stock: v.stock ?? UNTRACKED_STOCK,
          ...(v.image ? { image: v.image } : {}),
        })),
    })),
  };

  return {
    tenant: tenant as Tenant,
    catalog,
    storefront: doc.storefront as Storefront,
    seo: doc.seo as Seo,
    appearance: (doc.appearance as DbBundle["appearance"]) ?? null,
  };
}
