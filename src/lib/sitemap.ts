import type { MetadataRoute } from "next";
import type { TenantBundle } from "@/tenants";
import { visibleProducts } from "./catalog";
import { asset } from "./assets";
import { productPath } from "./seo";
import { COMPLAINTS_ROUTE, CONTACT_ROUTE, LEGAL_ROUTES } from "./legal";
import { PARTY_ROUTE, isContactForm } from "./customOrder";
import { isPreviewHost, storeLive, validDomain } from "./hosts";

/** Rutas que nunca se indexan: admin, servidor y pasos de compra. */
export const PRIVATE_PATHS = ["/admin", "/api/", "/carrito", "/checkout", "/pedido/", "/resena/"];

export type Exposure =
  /** demo.*, *.vercel.app, localhost o SEO con «indexar» apagado: nada se indexa. */
  | "hidden"
  /** Dominio principal con la tienda aún en construcción: solo la portada (/pronto). */
  | "coming-soon"
  /** Tienda lanzada en el dominio principal. */
  | "live";

export function exposure(host: string, bundle: TenantBundle): Exposure {
  if (isPreviewHost(host) || !bundle.seo.indexing) return "hidden";
  return storeLive() ? "live" : "coming-soon";
}

/** Origen público: el dominio de la marca si está definido; si no, el host que pidió el archivo. */
export function siteOrigin(host: string, bundle: TenantBundle): string {
  return `https://${validDomain(bundle.tenant.domain) ?? host}`;
}

/** Páginas públicas de la tienda que van en el sitemap (sin carrito ni checkout). */
export function sitemapEntries(bundle: TenantBundle, origin: string, mode: Exposure): MetadataRoute.Sitemap {
  if (mode === "hidden") return [];
  const url = (path: string) => `${origin}${path === "/" ? "" : path}`;
  if (mode === "coming-soon") return [{ url: url("/"), changeFrequency: "weekly", priority: 1 }];

  const { tenant, catalog } = bundle;
  const entries: MetadataRoute.Sitemap = [
    { url: url("/"), changeFrequency: "daily", priority: 1 },
    { url: url("/tienda"), changeFrequency: "daily", priority: 0.9 },
  ];
  for (const p of visibleProducts(catalog)) {
    const images = p.images.map((src) => {
      const a = asset(tenant.slug, src);
      return a.startsWith("/") && !a.startsWith("//") ? `${origin}${a}` : a;
    });
    entries.push({ url: url(productPath(p)), changeFrequency: "weekly", priority: 0.8, images: images.length ? images : undefined });
  }
  entries.push({ url: url(CONTACT_ROUTE), changeFrequency: "monthly", priority: 0.6 });
  if (tenant.customOrder.enabled && !isContactForm(tenant)) entries.push({ url: url(PARTY_ROUTE), changeFrequency: "monthly", priority: 0.6 });
  for (const path of [...Object.values(LEGAL_ROUTES), COMPLAINTS_ROUTE]) entries.push({ url: url(path), changeFrequency: "yearly", priority: 0.3 });
  return entries;
}

export function robotsRules(origin: string, mode: Exposure): MetadataRoute.Robots {
  if (mode === "hidden") return { rules: { userAgent: "*", disallow: "/" } };
  return { rules: { userAgent: "*", allow: "/", disallow: PRIVATE_PATHS }, sitemap: `${origin}/sitemap.xml` };
}
