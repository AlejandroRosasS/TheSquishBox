import type { Catalog, Seo, Storefront, Tenant } from "@/lib/types";
import squishTenant from "./squish/tenant.json";
import squishCatalog from "./squish/catalog.json";
import squishStorefront from "./squish/storefront.json";
import squishSeo from "./squish/seo.json";
import squishAdminDemo from "./squish/admin-demo.json";
import type { AdminDemo } from "@/lib/admin/types";
import type { Tokens } from "@/lib/publishedTheme";

export type TenantBundle = {
  tenant: Tenant;
  catalog: Catalog;
  storefront: Storefront;
  seo: Seo;
  /** Paleta publicada desde Admin › Apariencia (null = la paleta por defecto del tenant). */
  appearance?: { key: string | null; tokens: Tokens } | null;
  /** "db" cuando viene de Supabase; "files" cuando sale de los JSON del repo. */
  source?: "db" | "files";
};

/**
 * Registro de marcas. Agregar una marca = agregar su carpeta y una línea aquí.
 * En Fase 3 esto se reemplaza por la base de datos.
 */
/** Datos de ejemplo del admin (Fase 2). En Fase 3 salen de la base de datos. */
export const adminDemos: Record<string, AdminDemo> = {
  squish: squishAdminDemo as unknown as AdminDemo,
};

export const tenants: Record<string, TenantBundle> = {
  squish: {
    tenant: squishTenant as Tenant,
    catalog: squishCatalog as Catalog,
    storefront: squishStorefront as unknown as Storefront,
    seo: squishSeo as Seo,
  },
};
