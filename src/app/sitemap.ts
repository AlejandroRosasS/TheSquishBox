import type { MetadataRoute } from "next";
import { headers } from "next/headers";
import { getTenantBundle } from "@/lib/tenant";
import { cleanHost } from "@/lib/hosts";
import { exposure, siteOrigin, sitemapEntries } from "@/lib/sitemap";

/** /sitemap.xml de la marca del despliegue: portada, catálogo, cada producto publicado y páginas fijas. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const host = cleanHost((await headers()).get("host"));
  const bundle = await getTenantBundle();
  return sitemapEntries(bundle, siteOrigin(host, bundle), exposure(host, bundle));
}
