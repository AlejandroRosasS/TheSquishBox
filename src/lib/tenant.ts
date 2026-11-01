import { cacheLife, cacheTag } from "next/cache";
import { adminDemos, tenants, type TenantBundle } from "@/tenants";
import { dbConfigured } from "@/lib/db/env";
import { loadBundleFromDb } from "@/lib/db/bundle";

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
  cacheLife("hours");
  if (!dbConfigured()) return fileBundle(slug);
  const fromDb = await loadBundleFromDb(slug);
  return fromDb ? { ...fromDb, source: "db" } : fileBundle(slug);
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
