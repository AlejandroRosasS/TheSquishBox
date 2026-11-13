import type { TenantBundle } from "@/tenants";
import type { Product } from "./types";
import { asset } from "./assets";
import { hasOptions, isSoldOut, visibleProducts } from "./catalog";
import { businessOf, isPlaceholder, isShown } from "./legal";
import { absoluteUrl, productPath, productSeo } from "./seo";

/**
 * Datos estructurados (schema.org, JSON-LD) para Google. Todo sale del tenant: sirven para cualquier marca.
 * Sin dominio público (ni el de la marca ni el de Vercel) no se generan: Google exige URLs absolutas.
 */
type Ld = Record<string, unknown>;

const price = (n: number) => n.toFixed(2);

function abs(bundle: TenantBundle, path: string) {
  return absoluteUrl(bundle.tenant.domain, path);
}

function images(bundle: TenantBundle, list: string[]): string[] {
  return list.map((src) => abs(bundle, asset(bundle.tenant.slug, src))).filter((u): u is string => !!u);
}

/** Product + Offer (o AggregateOffer si las opciones tienen precios distintos). */
export function productLd(bundle: TenantBundle, p: Product): Ld | null {
  const { tenant, seo } = bundle;
  const url = abs(bundle, productPath(p));
  if (!url || !p.variants.length) return null;
  const meta = productSeo(seo, p);
  const availability = isSoldOut(p) ? "https://schema.org/OutOfStock" : "https://schema.org/InStock";
  const prices = p.variants.map((v) => v.price);
  const low = Math.min(...prices);
  const high = Math.max(...prices);
  // El precio es el mismo que muestra la página y cobra el checkout (Google exige que coincidan).
  const offers: Ld =
    hasOptions(p) && low !== high
      ? { "@type": "AggregateOffer", priceCurrency: tenant.currency, lowPrice: price(low), highPrice: price(high), offerCount: p.variants.length, availability, url }
      : { "@type": "Offer", priceCurrency: tenant.currency, price: price(low), availability, itemCondition: "https://schema.org/NewCondition", url, seller: { "@type": "Organization", name: tenant.name } };
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    "@id": `${url}#product`,
    name: p.name,
    description: meta.description || p.description,
    sku: p.id,
    image: images(bundle, p.images),
    url,
    brand: { "@type": "Brand", name: tenant.name },
    offers,
    ...reviewLd(bundle, p),
  };
}

/**
 * Estrellas para Google: solo con reseñas APROBADAS de clientes reales (link único por compra).
 * Sin reseñas no se manda nada (el producto sigue siendo válido). Se mandan las 5 más nuevas.
 */
function reviewLd(bundle: TenantBundle, p: Product): Ld {
  const mine = (bundle.reviews ?? []).filter((r) => r.productId === p.id);
  if (!p.rating || !mine.length) return {};
  return {
    aggregateRating: { "@type": "AggregateRating", ratingValue: p.rating.avg.toFixed(1), reviewCount: p.rating.count, bestRating: 5, worstRating: 1 },
    review: mine.slice(0, 5).map((r) => ({
      "@type": "Review",
      reviewRating: { "@type": "Rating", ratingValue: r.rating, bestRating: 5, worstRating: 1 },
      author: { "@type": "Person", name: r.author },
      datePublished: r.createdAt.slice(0, 10),
      ...(r.body ? { reviewBody: r.body } : {}),
    })),
  };
}

/** OnlineStore de la portada: nombre, logo, redes y los datos de contacto que la marca muestra. */
export function storeLd(bundle: TenantBundle): Ld | null {
  const { tenant, storefront, seo } = bundle;
  const url = abs(bundle, "/");
  if (!url) return null;
  const b = businessOf(tenant, storefront);
  const real = (v: string | undefined) => (isPlaceholder(v) ? undefined : v);
  const logo = tenant.logo.type === "image" && tenant.logo.image ? abs(bundle, asset(tenant.slug, tenant.logo.image)) : undefined;
  const share = seo.shareImage ? images(bundle, [seo.shareImage])[0] : undefined;
  const instagram = real(tenant.instagram) && isShown(b, "instagram") ? `https://www.instagram.com/${tenant.instagram}/` : undefined;
  const address = isShown(b, "address") ? real(b.address) : undefined;
  const country = tenant.locale.split("-")[1];
  const ld: Ld = {
    "@context": "https://schema.org",
    "@type": "OnlineStore",
    "@id": `${url}#store`,
    name: tenant.name,
    url,
    description: seo.description || tenant.tagline,
    logo,
    image: share ?? logo,
    sameAs: instagram ? [instagram] : undefined,
    legalName: real(b.legalName),
    taxID: real(b.ruc),
    telephone: isShown(b, "phone") ? real(b.phone) : undefined,
    email: isShown(b, "email") ? real(b.email) : undefined,
    address: address ? { "@type": "PostalAddress", streetAddress: address, addressLocality: real(tenant.city), addressCountry: country } : undefined,
    currenciesAccepted: tenant.currency,
    hasOfferCatalog: {
      "@type": "OfferCatalog",
      name: tenant.name,
      itemListElement: visibleProducts(bundle.catalog).map((p) => ({ "@type": "Offer", itemOffered: { "@id": `${abs(bundle, productPath(p))}#product`, "@type": "Product", name: p.name } })),
    },
  };
  return JSON.parse(JSON.stringify(ld)) as Ld; // quita los campos vacíos
}

/** JSON listo para <script type="application/ld+json"> (sin "</script>" que corte el HTML). */
export function ldJson(data: Ld): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
