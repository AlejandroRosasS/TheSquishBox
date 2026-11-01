export type PaletteTokens = {
  name: string;
  bg: string;
  surface: string;
  primary: string;
  onPrimary: string;
  accent: string;
  text: string;
  text2: string;
  border: string;
};

export type Tenant = {
  slug: string;
  name: string;
  instagram: string;
  city: string;
  tagline: string;
  motto: string;
  domain: string;
  whatsapp: string;
  currency: string;
  locale: string;
  fonts: { display: string; body: string; googleFontsUrl?: string };
  logo: {
    type: "css" | "image";
    lines?: { text: string; color: string }[];
    background?: string;
    image?: string;
  };
  brandColors: Record<string, string>;
  defaultPalette: string;
  palettes: Record<string, PaletteTokens>;
  highlights: string[];
  customOrder: { enabled: boolean; label: string; description: string; adminLabel?: string; adminShort?: string };
  payments: { provider: string; methods: string[] };
  fulfillment: { delivery: string; pickup: string };
  salesChannels: string[];
  notes?: string;
};

export type Variant = {
  id: string;
  label: string;
  price: number;
  priceIsReference: boolean;
  stock: number;
  /** Id de la variante en la base de datos (cuando la tienda lee de Supabase). */
  dbId?: string;
  /** Foto opcional de esta opción (una de las fotos del producto). */
  image?: string;
};

/**
 * simple: un solo precio (exactamente 1 variante, varias fotos).
 * options: el cliente elige una opción y cada una tiene su precio (2 o más variantes, sin tope).
 */
export type ProductKind = "simple" | "options";

export type Product = {
  id: string;
  name: string;
  line: string;
  badge?: string;
  status: "published" | "sold_out" | "draft";
  /** simple = 1 variante; options = 2 o más. Si falta se deduce de variants.length. */
  kind?: ProductKind;
  /** Pregunta del selector de opciones; si falta se usa storefront.product.variantQuestion. */
  optionsLabel?: string;
  description: string;
  variants: Variant[];
  images: string[];
};

export type Line = { id: string; name: string; order: number };

export type Catalog = {
  pricesNote?: string;
  lines: Line[];
  products: Product[];
  collectibleModels?: {
    note: string;
    items: { name: string; size?: string; image: string }[];
  };
  tips?: string[];
  benefits?: string[];
};

type Link = { label: string; href: string };

/** Tipo de caja del pedido para fiestas. price = precio referencial por caja (0 = a cotizar). */
export type PartyBox = { name: string; sizes: { name: string; price: number }[] };
/** `imageMobile`: foto distinta para celular (opcional; si no hay, se usa `image` con otro encuadre). */
type Img = { image: string; imageMobile?: string; alt: string };

/** Textos e imágenes de la tienda pública (lo que en los mockups estaba escrito a mano). */
export type Storefront = {
  brand: {
    ink: string;
    emphasis: string;
    highlights: { bg: string; fg: string }[];
  };
  announce: string;
  nav: Link[];
  hero: Img & {
    eyebrow: string;
    title: string;
    lead: string;
    primaryCta: Link;
    secondaryCta: Link;
  };
  highlights: Link[];
  tiles: (Img & { eyebrow: string; title: string; href: string })[];
  featured: { eyebrow: string; title: string; productIds: string[]; viewAll: string; viewAllMobile: string };
  partyBand: Img & { eyebrow: string; title: string; lead: string; steps: string[]; cta: string };
  inside: Img & { eyebrow: string; title: string; lead: string; body: string };
  models: { eyebrow: string; title: string; footnote: string; max: number };
  tips: { eyebrow: string; title: string; items: { title: string; text: string }[] };
  footer: { about: string; shop: Link[]; help: Link[]; legal: string; legalLinks: string };
  catalog: {
    title: string;
    lead: string;
    allLabel: string;
    priceRanges: { label: string; min?: number; max?: number }[];
    partyCta: { title: string; text: string; cta: string };
  };
  product: {
    variantQuestion: string;
    partyHint: string;
    deliveryNote: string;
    tipsTitle: string;
    soldOutAllText: string;
    soldOutVariantText: string;
    moreTitle: string;
  };
  cart: {
    emptyTitle: string;
    emptyLead: string;
    emptyPrimary: Link;
    emptySecondary: Link;
    popularTitle: string;
    popularIds: string[];
    deliveryNote: string;
  };
  checkout: {
    deliveryLabel: string;
    pickupLabel: string;
    pickupNote: string;
    giftHint: string;
    deliveryRates: Record<string, number | null>;
    deliveryRatesAreExample: boolean;
    defaultDistrict: string;
  };
  confirmation: { title: string; lead: string; collectNote: string };
  party: {
    productId: string;
    eyebrow: string;
    title: string;
    lead: string;
    image: string;
    imageAlt: string;
    steps: { title: string; text: string }[];
    quantityQuestion?: string;
    quantities: string[];
    /** Texto del campo para escribir una cantidad que no está entre las opciones. */
    otherQuantityLabel?: string;
    defaultQuantity: string;
    /** Pregunta para elegir el tipo de caja (va primero). */
    boxQuestion?: string;
    /** Tipos de caja; cada uno con sus propias opciones de squishies por caja. Se editan en Admin › Textos. */
    boxes?: PartyBox[];
    sizeQuestion: string;
    unsureLabel: string;
    extrasLabel: string;
    extrasOptions: string[];
    districts: string[];
    commentsPlaceholder: string;
    footnote: string;
    sentTitle: string;
    sentLead: string;
  };
  notFound: Img & { title: string; lead: string };
};

export type SeoPage = { title: string; description: string };

/** SEO de la tienda (tenants/<slug>/seo.json). Se edita desde Admin › SEO. */
export type Seo = {
  siteTitle: string;
  titleTemplate: string;
  description: string;
  shareImage: string;
  pages: Record<string, SeoPage>;
  products: Record<string, Partial<SeoPage>>;
  indexing: boolean;
  googleVerification: string;
};
