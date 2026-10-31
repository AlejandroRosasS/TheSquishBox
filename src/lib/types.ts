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
  customOrder: { enabled: boolean; label: string; description: string };
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
};

export type Product = {
  id: string;
  name: string;
  line: string;
  badge?: string;
  status: "published" | "sold_out" | "draft";
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
type Img = { image: string; alt: string };

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
    quantities: string[];
    defaultQuantity: string;
    sizeQuestion: string;
    unsureLabel: string;
    colors: { name: string; hex: string }[];
    extrasLabel: string;
    extrasOptions: string[];
    districts: string[];
    commentsPlaceholder: string;
    uploadHint: string;
    footnote: string;
    sentTitle: string;
    sentLead: string;
  };
  notFound: Img & { title: string; lead: string };
};
