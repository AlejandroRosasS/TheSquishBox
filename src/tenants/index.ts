import type { Catalog, Seo, Storefront, Tenant } from "@/lib/types";
import type { Review } from "@/lib/reviews";
import squishTenant from "./squish/tenant.json";
import squishCatalog from "./squish/catalog.json";
import squishStorefront from "./squish/storefront.json";
import squishSeo from "./squish/seo.json";
import squishAdminDemo from "./squish/admin-demo.json";
import squishMedia from "./squish/media.json";
import bloomTenant from "./bloom/tenant.json";
import bloomCatalog from "./bloom/catalog.json";
import bloomStorefront from "./bloom/storefront.json";
import bloomSeo from "./bloom/seo.json";
import bloomAdminDemo from "./bloom/admin-demo.json";
import bloomMedia from "./bloom/media.json";
import sharedLegal from "./_shared/legal.json";
import { withDefaults } from "@/lib/defaults";
import type { MediaMap } from "@/lib/media";
import type { AdminDemo } from "@/lib/admin/types";
import type { AppearanceDoc } from "@/lib/brand";

export type TenantBundle = {
  tenant: Tenant;
  catalog: Catalog;
  storefront: Storefront;
  seo: Seo;
  /** Paleta, nombre y logo publicados desde Admin › Apariencia (null = los del tenant). */
  appearance?: AppearanceDoc | null;
  /** "db" cuando viene de Supabase; "files" cuando sale de los JSON del repo. */
  source?: "db" | "files";
  /** Encuadres y datos de las fotos de la marca (por src). */
  media?: MediaMap;
  /** Llave pública de Culqi de la marca, si el cobro con tarjeta está activo (solo con Supabase). */
  culqiKey?: string | null;
  /** Reseñas aprobadas, las más nuevas primero (solo con Supabase). */
  reviews?: Review[];
};

/**
 * Registro de marcas. Agregar una marca = agregar su carpeta y una línea aquí.
 * En Fase 3 esto se reemplaza por la base de datos.
 */
/** Datos de ejemplo del admin (Fase 2). En Fase 3 salen de la base de datos. */
export const adminDemos: Record<string, AdminDemo> = {
  squish: squishAdminDemo as unknown as AdminDemo,
  bloom: bloomAdminDemo as unknown as AdminDemo,
};

/** Textos de la marca sobre la base legal común (contacto, términos, políticas, libro de reclamaciones). */
const storefrontOf = (own: unknown) => withDefaults(sharedLegal as unknown as Storefront, own as Storefront);

export const tenants: Record<string, TenantBundle> = {
  squish: {
    tenant: squishTenant as Tenant,
    catalog: squishCatalog as Catalog,
    storefront: storefrontOf(squishStorefront),
    seo: squishSeo as Seo,
    media: squishMedia as MediaMap,
  },
  bloom: {
    tenant: bloomTenant as Tenant,
    catalog: bloomCatalog as unknown as Catalog,
    storefront: storefrontOf(bloomStorefront),
    seo: bloomSeo as Seo,
    media: bloomMedia as MediaMap,
  },
};
