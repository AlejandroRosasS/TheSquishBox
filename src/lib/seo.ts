import type { Metadata } from "next";
import type { TenantBundle } from "@/tenants";
import type { Product, Seo, SeoPage } from "./types";
import { asset } from "./assets";
import { validDomain } from "./hosts";
import { plainText } from "./format";

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
export function siteUrl(domain: string): URL | undefined {
  const host = validDomain(domain) ?? process.env.VERCEL_PROJECT_PRODUCTION_URL;
  return host ? new URL(`https://${host}`) : undefined;
}

/** URL absoluta de una ruta de la tienda (canonical, og:url, JSON-LD). */
export function absoluteUrl(domain: string, path: string): string | undefined {
  const base = siteUrl(domain);
  return base ? new URL(path, base).toString() : undefined;
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

/** Open Graph común: Next no mezcla el openGraph del layout con el de la página, así que va completo. */
function og(bundle: TenantBundle, path: string, title: string, description: string, image?: string): NonNullable<Metadata["openGraph"]> {
  const { tenant } = bundle;
  return { type: "website", siteName: tenant.name, locale: tenant.locale.replace("-", "_"), url: path, title, description, images: shareImages(bundle, image) };
}

/**
 * Metadatos de una página pública. `path` es su URL oficial: Next la vuelve absoluta con
 * metadataBase (el dominio de la marca), igual que el sitemap.
 */
function build(bundle: TenantBundle, page: SeoPage, path: string, image?: string): Metadata {
  // Sin marcas de formato: un *énfasis* del texto no debe llegar con asteriscos a Google.
  const description = plainText(page.description || bundle.seo.description);
  const title = plainText(page.title);
  const full = applyTemplate(bundle.seo, title);
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: og(bundle, path, full, description, image),
    twitter: { title: full, description },
  };
}

/** Portada: título y descripción generales de la marca. */
export function homeMetadata(bundle: TenantBundle): Metadata {
  const { seo } = bundle;
  return {
    alternates: { canonical: "/" },
    openGraph: og(bundle, "/", seo.siteTitle, seo.description),
  };
}

export const SEO_PAGE_PATH: Record<SeoPageKey, string> = { tienda: "/tienda", fiesta: "/fiesta", carrito: "/carrito" };

export function pageMetadata(bundle: TenantBundle, key: SeoPageKey, fallback: SeoPage): Metadata {
  const meta = build(bundle, { ...fallback, ...(bundle.seo.pages[key] ?? {}) }, SEO_PAGE_PATH[key]);
  // El carrito es de cada visitante: no se indexa (robots.txt también lo bloquea).
  return key === "carrito" ? { ...meta, robots: { index: false, follow: true } } : meta;
}

export function productSeo(seo: Seo, p: Product): SeoPage {
  const o = seo.products[p.id] ?? {};
  return { title: o.title || p.name, description: o.description || p.description };
}

export const productPath = (p: Pick<Product, "id">) => `/p/${encodeURIComponent(p.id)}`;

export function productMetadata(bundle: TenantBundle, p: Product): Metadata {
  return build(bundle, productSeo(bundle.seo, p), productPath(p), p.images[0]);
}

/** Metadatos de una página sin entrada propia en SEO (páginas legales, contacto). */
export function plainMetadata(bundle: TenantBundle, page: SeoPage, path: string): Metadata {
  return build(bundle, page, path);
}
