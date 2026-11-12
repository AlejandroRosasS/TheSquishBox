import type { MetadataRoute } from "next";
import { headers } from "next/headers";
import { getTenantBundle } from "@/lib/tenant";
import { cleanHost } from "@/lib/hosts";
import { exposure, robotsRules, siteOrigin } from "@/lib/sitemap";

/** /robots.txt: bloquea todo en demo/vercel.app (o con «indexar» apagado) y apunta al sitemap en el dominio de la marca. */
export default async function robots(): Promise<MetadataRoute.Robots> {
  const host = cleanHost((await headers()).get("host"));
  const bundle = await getTenantBundle();
  return robotsRules(siteOrigin(host, bundle), exposure(host, bundle));
}
