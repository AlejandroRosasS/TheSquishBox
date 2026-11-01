import type { Catalog, Seo, Storefront, Tenant } from "@/lib/types";
import squishTenant from "./squish/tenant.json";
import squishCatalog from "./squish/catalog.json";
import squishStorefront from "./squish/storefront.json";
import squishSeo from "./squish/seo.json";

export type TenantBundle = { tenant: Tenant; catalog: Catalog; storefront: Storefront; seo: Seo };

/**
 * Registro de marcas. Agregar una marca = agregar su carpeta y una línea aquí.
 * En Fase 3 esto se reemplaza por la base de datos.
 */
export const tenants: Record<string, TenantBundle> = {
  squish: {
    tenant: squishTenant as Tenant,
    catalog: squishCatalog as Catalog,
    storefront: squishStorefront as unknown as Storefront,
    seo: squishSeo as Seo,
  },
};
