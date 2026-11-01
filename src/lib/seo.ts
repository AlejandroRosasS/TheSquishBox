import type { Metadata } from "next";
import type { TenantBundle } from "@/tenants";
import type { Product, Seo, SeoPage } from "./types";
import { asset } from "./assets";

/** Nombre de página que reconoce Admin › SEO (las rutas públicas que se indexan). */
export type SeoPageKey = "tienda" | "fiesta" | "carrito";

export const SEO_LIMITS = { title: 60, description: 160 } as const;

export function applyTemplate(seo: Seo, title: string): string {
  return seo.titleTemplate.includes("%s") ? seo.titleTemplate.replace("%s", title) : title;
}

function shareImages(bundle: TenantBundle, image?: string) {
  const src = image || bundle.seo.shareImage;
  return src ? [{ url: asset(bundle.tenant.slug, src) }] : undefined;
}

/** URL pública de la tienda: el dominio de la marca si ya está definido; si no, la de Vercel. */
function siteUrl(domain: string): URL | undefined {
  const host = /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(domain) ? domain : process.env.VERCEL_PROJECT_PRODUCTION_URL;
  return host ? new URL(`https://${host}`) : undefined;
}

/** Metadatos base de toda la tienda (layout raíz). */
export function siteMetadata(bundle: TenantBundle): Metadata {
  const { tenant, seo } = bundle;
  const images = shareImages(bundle);
  return {
    metadataBase: siteUrl(tenant.domain),
    title: { default: seo.siteTitle, template: seo.titleTemplate },
    description: seo.description,
    openGraph: { type: "website", siteName: tenant.name, locale: tenant.locale.replace("-", "_"), title: seo.siteTitle, description: seo.description, images },
    twitter: { card: images ? "summary_large_image" : "summary", title: seo.siteTitle, description: seo.description },
    robots: seo.indexing ? undefined : { index: false, follow: false },
    verification: seo.googleVerification ? { google: seo.googleVerification } : undefined,
  };
}

function build(bundle: TenantBundle, page: SeoPage, image?: string): Metadata {
  const description = page.description || bundle.seo.description;
  const full = applyTemplate(bundle.seo, page.title);
  return {
    title: page.title,
    description,
    openGraph: { title: full, description, images: shareImages(bundle, image) },
    twitter: { title: full, description },
  };
}

export function pageMetadata(bundle: TenantBundle, key: SeoPageKey, fallback: SeoPage): Metadata {
  return build(bundle, { ...fallback, ...(bundle.seo.pages[key] ?? {}) });
}

export function productSeo(seo: Seo, p: Product): SeoPage {
  const o = seo.products[p.id] ?? {};
  return { title: o.title || p.name, description: o.description || p.description };
}

export function productMetadata(bundle: TenantBundle, p: Product): Metadata {
  return build(bundle, productSeo(bundle.seo, p), p.images[0]);
}
