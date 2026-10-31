import { tenants, type TenantBundle } from "@/tenants";

/**
 * Resuelve la marca activa. En local: variable TENANT (por defecto "squish").
 * En producción se resolverá por dominio (Fase 3).
 */
export function getTenantBundle(): TenantBundle {
  const slug = process.env.TENANT || "squish";
  const bundle = tenants[slug];
  if (!bundle) throw new Error(`Tenant desconocido: "${slug}". Revisa la variable TENANT.`);
  return bundle;
}
