import type { Campaign, Catalog, Product, Seo, Storefront, Tenant } from "@/lib/types";
import type { AppearanceDoc } from "@/lib/brand";
import type { MediaMap } from "@/lib/media";
import { publicClient } from "./public";
import { UNTRACKED_STOCK } from "@/lib/catalog";
import { PUBLIC_REVIEW_COLUMNS, type PublicReviewRow, type Review } from "@/lib/reviews";

export type DbBundle = {
  tenant: Tenant;
  catalog: Catalog;
  storefront: Storefront;
  seo: Seo;
  appearance: AppearanceDoc | null;
  media: MediaMap;
  culqiKey: string | null;
  /** Campañas de oferta vigentes (sin aplicar todavía al catálogo). */
  campaigns: Campaign[];
  /** Próximo inicio o fin de campaña (ISO): ahí cambia algún precio y hay que refrescar la tienda. */
  nextPriceChange: string | null;
  /** Reseñas aprobadas, las más nuevas primero. */
  reviews: Review[];
};

type CampaignRow = { id: string; name: string; starts_at: string; ends_at: string; prices: Campaign["prices"] };

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

  const [docs, lines, products, media, culqi, camp, revs] = await Promise.all([
    db.from("site_docs").select("kind, body").eq("tenant_id", t.id).eq("stage", "published"),
    db.from("product_lines").select("id, name, position").eq("tenant_id", t.id).order("position"),
    db.from("products")
      .select("id, slug, name, line, badge, status, kind, options_label, description, images, position, extra, product_variants(id, key, label, price, price_is_reference, stock, image, position)")
      .eq("tenant_id", t.id)
      .neq("status", "draft")
      .order("position"),
    db.from("media").select("src, origin, width, height, alt, frames").eq("tenant_id", t.id),
    // Si la migración de pagos aún no está aplicada, la tienda sigue sin tarjeta (no se rompe).
    db.rpc("culqi_public_key", { tenant_slug: slug }),
    // Sin la migración 0008 no hay campañas: la tienda sigue con los precios regulares.
    db.rpc("store_campaigns", { tenant_slug: slug }),
    // Sin la migración 0017 no hay reseñas: la tienda sigue sin estrellas.
    db.from("reviews").select(PUBLIC_REVIEW_COLUMNS).eq("tenant_id", t.id).eq("status", "approved").order("created_at", { ascending: false }).limit(500),
  ]);
  const campData = !camp.error && camp.data ? (camp.data as { campaigns?: CampaignRow[]; next_change?: string | null }) : null;
  for (const r of [docs, lines, products, media]) if (r.error) throw new Error(`Supabase: ${r.error.message}`);

  const doc = Object.fromEntries((docs.data ?? []).map((d) => [d.kind, d.body])) as Record<string, unknown>;
  const tenantDoc = doc.tenant as (Tenant & { catalogExtras?: Partial<Catalog> }) | undefined;
  if (!tenantDoc || !doc.storefront || !doc.seo) return null;

  const { catalogExtras, ...tenant } = tenantDoc;
  const productRows = (products.data ?? []) as ProductRow[];
  const slugOf = new Map(productRows.map((p) => [p.id, p.slug]));
  const reviews: Review[] = (!revs.error && revs.data ? (revs.data as PublicReviewRow[]) : [])
    .filter((r) => slugOf.has(r.product_id))
    .map((r) => ({
      id: r.id,
      productId: slugOf.get(r.product_id) as string,
      rating: Number(r.rating),
      body: r.body ?? "",
      author: r.author_name,
      verified: r.verified,
      reply: r.reply ?? "",
      createdAt: r.created_at,
    }));
  const ratings = new Map<string, { sum: number; count: number }>();
  for (const r of reviews) {
    const a = ratings.get(r.productId) ?? { sum: 0, count: 0 };
    ratings.set(r.productId, { sum: a.sum + r.rating, count: a.count + 1 });
  }
  const catalog: Catalog = {
    ...catalogExtras,
    lines: (lines.data ?? []).map((l) => ({ id: l.id, name: l.name, order: l.position })),
    products: productRows.map((p) => ({
      id: p.slug,
      dbId: p.id,
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
      ...(Number(p.extra?.minQty) > 1 ? { minQty: Number(p.extra.minQty) } : {}),
      ...(ratings.has(p.slug) ? { rating: { avg: ratings.get(p.slug)!.sum / ratings.get(p.slug)!.count, count: ratings.get(p.slug)!.count } } : {}),
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
    campaigns: (campData?.campaigns ?? []).map((c) => ({ id: c.id, name: c.name, startsAt: c.starts_at, endsAt: c.ends_at, prices: c.prices ?? {} })),
    nextPriceChange: campData?.next_change ?? null,
    reviews,
    culqiKey: !culqi.error && typeof culqi.data === "string" && culqi.data ? culqi.data : null,
    media: Object.fromEntries((media.data ?? []).map((m) => [m.src, { src: m.src, origin: m.origin, width: m.width ?? undefined, height: m.height ?? undefined, alt: m.alt, frames: m.frames ?? {} }])) as MediaMap,
  };
}
