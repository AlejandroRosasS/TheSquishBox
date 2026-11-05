import type { SupabaseClient } from "@supabase/supabase-js";
import type { Campaign } from "../types";
import type { CatalogLite } from "./csv";

type ProductRow = { slug: string; name: string; status: string; position: number; product_variants: { key: string; label: string; price: number | string; position: number }[] };
type CampaignRow = { id: string; name: string; starts_at: string; ends_at: string; prices: Campaign["prices"] | null };

/** Catálogo (sin borradores) y campañas de la marca, para leer CSV en el servidor (bot de Telegram). */
export async function salesContext(db: SupabaseClient, tenantId: string): Promise<{ catalog: CatalogLite; campaigns: Campaign[] }> {
  const [p, c] = await Promise.all([
    db.from("products").select("slug, name, status, position, product_variants(key, label, price, position)").eq("tenant_id", tenantId).neq("status", "draft").order("position"),
    db.from("price_campaigns").select("id, name, starts_at, ends_at, prices").eq("tenant_id", tenantId),
  ]);
  if (p.error) throw new Error(p.error.message);
  const catalog: CatalogLite = {
    products: ((p.data ?? []) as ProductRow[])
      .map((r) => ({
        id: r.slug,
        name: r.name,
        variants: [...(r.product_variants ?? [])].sort((a, b) => a.position - b.position).map((v) => ({ id: v.key, label: v.label, price: Number(v.price) })),
      }))
      .filter((x) => x.variants.length),
  };
  // Sin la tabla de campañas (migración 0008) se sigue con precios regulares.
  const campaigns = ((c.error ? [] : c.data ?? []) as CampaignRow[]).map((r) => ({
    id: r.id, name: r.name, startsAt: new Date(r.starts_at).toISOString(), endsAt: new Date(r.ends_at).toISOString(), prices: r.prices ?? {},
  }));
  return { catalog, campaigns };
}

/** Referencias ya guardadas (para avisar de ventas repetidas antes de confirmar). */
export async function existingRefs(db: SupabaseClient, tenantId: string, refs: string[]): Promise<Set<string>> {
  if (!refs.length) return new Set();
  const { data } = await db.from("manual_sales").select("ref").eq("tenant_id", tenantId).in("ref", refs);
  return new Set((data ?? []).map((r) => r.ref as string));
}
