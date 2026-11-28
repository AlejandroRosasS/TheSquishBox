import { cacheLife, cacheTag } from "next/cache";
import { adminDemos, tenants, type TenantBundle } from "@/tenants";
import { dbConfigured } from "@/lib/db/env";
import { loadBundleFromDb } from "@/lib/db/bundle";
import { withDefaults } from "@/lib/defaults";
import { applyCampaigns, hasActiveLimits } from "@/lib/campaigns";
import { withBrand } from "@/lib/brand";
import { nextNewsExpiry, withActiveNews } from "@/lib/news";

/** Marca activa del despliegue (variable TENANT, por defecto "squish"). */
export function tenantSlug(): string {
  return process.env.TENANT || "squish";
}

export const tenantTag = (slug: string) => `tenant:${slug}`;

function fileBundle(slug: string): TenantBundle {
  const bundle = tenants[slug];
  if (!bundle) throw new Error(`Tenant desconocido: "${slug}". Revisa la variable TENANT.`);
  return { ...bundle, appearance: null, source: "files" };
}

/**
 * Datos publicados de la marca. Con Supabase configurado salen de la base
 * (cacheados; el admin los refresca al publicar con `revalidateTag`). Sin Supabase, de los JSON del repo.
 */
export async function getTenantBundle(): Promise<TenantBundle> {
  "use cache";
  const slug = tenantSlug();
  cacheTag(tenantTag(slug));
  if (!dbConfigured()) return hours(activeFileBundle(slug));
  const fromDb = await loadBundleFromDb(slug);
  if (!fromDb) return hours(activeFileBundle(slug));
  const { campaigns, nextPriceChange, ...rest } = fromDb;
  const now = Date.now();
  const files = tenants[slug];
  const storefront = files ? withDefaults(files.storefront, fromDb.storefront) : fromDb.storefront;
  // Si una campaña empieza o termina pronto (o vence una novedad), la tienda se vuelve a armar a esa hora (como mínimo cada minuto).
  const nextNews = nextNewsExpiry(storefront, now);
  const untilChange = Math.min(
    nextPriceChange ? Math.ceil((Date.parse(nextPriceChange) - now) / 1000) : Infinity,
    nextNews ? Math.ceil((Date.parse(nextNews) - now) / 1000) : Infinity,
  );
  // Con tope de unidades, una oferta puede agotarse en cualquier momento: la tienda se refresca cada minuto.
  if (hasActiveLimits(campaigns, now)) cacheLife({ stale: 60, revalidate: 60, expire: 86400 });
  else if (untilChange < 3600) cacheLife({ stale: 300, revalidate: Math.max(60, untilChange), expire: 86400 });
  else cacheLife("hours");
  // Lo publicado manda; los archivos completan las claves nuevas que el código agregó después.
  return {
    ...rest,
    catalog: applyCampaigns(fromDb.catalog, campaigns, now),
    // Nombre y logo publicados en Apariencia mandan sobre los datos de la marca.
    tenant: withBrand(files ? withDefaults(files.tenant, fromDb.tenant) : fromDb.tenant, fromDb.appearance?.brand),
    // Las novedades vencidas ya no se muestran.
    storefront: withActiveNews(storefront, now),
    seo: files ? withDefaults(files.seo, fromDb.seo) : fromDb.seo,
    source: "db",
  };
}

/** Datos del repo sin las novedades vencidas. */
function activeFileBundle(slug: string): TenantBundle {
  const b = fileBundle(slug);
  return { ...b, storefront: withActiveNews(b.storefront, Date.now()) };
}

function hours<T>(v: T): T {
  cacheLife("hours");
  return v;
}

/** Versión sin base de datos: para lo que debe resolverse sin red (p. ej. la página "en construcción"). */
export function getFileBundle(): TenantBundle {
  return fileBundle(tenantSlug());
}

export function getAdminDemo(slug: string) {
  const demo = adminDemos[slug];
  if (!demo) throw new Error(`No hay datos de ejemplo del admin para "${slug}".`);
  return demo;
}
