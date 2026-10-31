import type { Catalog, Storefront, Tenant } from "@/lib/types";
import squishTenant from "./squish/tenant.json";
import squishCatalog from "./squish/catalog.json";
import squishStorefront from "./squish/storefront.json";

export type TenantBundle = { tenant: Tenant; catalog: Catalog; storefront: Storefront };

/**
 * Registro de marcas. Agregar una marca = agregar su carpeta y una línea aquí.
 * En Fase 3 esto se reemplaza por la base de datos.
 */
export const tenants: Record<string, TenantBundle> = {
  squish: {
    tenant: squishTenant as Tenant,
    catalog: squishCatalog as Catalog,
    storefront: squishStorefront as unknown as Storefront,
  },
};
