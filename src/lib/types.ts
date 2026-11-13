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
  /** Subtítulo debajo del nombre en el menú del panel (se edita en Admin › Apariencia). */
  panelSubtitle?: string;
  logo: {
    /** "image": se muestra con su forma propia (redonda, cuadrada o alargada), sin recortarla. */
    type: "css" | "image";
    lines?: { text: string; color: string }[];
    background?: string;
    image?: string;
  };
  brandColors: Record<string, string>;
  defaultPalette: string;
  palettes: Record<string, PaletteTokens>;
  highlights: string[];
  /**
   * Página de pedido especial de la marca. `form`: "party" = formulario de cotización (/fiesta);
   * "contact" = formulario en la página Contacto (/contacto) con motivo y mensaje; /fiesta redirige ahí. Sin `form` = "party".
   */
  customOrder: { enabled: boolean; label: string; description: string; adminLabel?: string; adminShort?: string; form?: "party" | "contact" };
  payments: {
    provider: string;
    methods: string[];
    /** Yape manual: el cliente yapea a este número (o QR) y manda la captura por WhatsApp. */
    yape?: { phone: string; holder?: string; qr?: string };
  };
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
  /** Con una campaña vigente: `price` es el de oferta y este el regular (se muestra tachado). */
  listPrice?: number;
  /** Campaña vigente que da el precio de oferta. */
  campaign?: { id: string; name: string; endsAt: string };
};

/**
 * Campaña de oferta: entre `startsAt` y `endsAt` (ISO) las opciones listadas se venden a su precio de campaña.
 * `prices`: {"<id del producto>": {"<id de la opción>": 59}}. Se editan en Admin › Productos › Precios.
 */
export type Campaign = { id: string; name: string; startsAt: string; endsAt: string; prices: Record<string, Record<string, number>> };

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
  /** false = se vende sin contar unidades (siempre disponible salvo que se marque agotado). */
  trackStock?: boolean;
  /** Pedido mínimo por línea del carrito (unidades de una misma opción). Si falta, 1. */
  minQty?: number;
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
/** `hidden`: datos que no se muestran en Contacto ni en el pie (ver BUSINESS_TOGGLES). Razón social y RUC siempre se ven. */
export type Business = { legalName: string; ruc: string; address: string; email: string; phone: string; hours: string; hidden?: string[] };
export type LegalPageKey = "terms" | "returns" | "shipping" | "privacy";
export type LegalDoc = { title: string; lead: string; sections: { title: string; text: string }[] };

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
  /** `photos`: fotos del recuadro de modelos. Si no hay, se usan los modelos del catálogo (`max` como tope). */
  models: { eyebrow: string; title: string; footnote: string; max: number; photos?: { image: string; alt: string }[] };
  tips: { eyebrow: string; title: string; items: { title: string; text: string }[] };
  /** `legal` y `legalLinks` son de la versión anterior (antes de las páginas legales): ya no se muestran. */
  footer: { about: string; shop: Link[]; help: Link[]; legal?: string; legalLinks?: string };
  /** Datos de la empresa: se muestran en el pie, Contacto, páginas legales y Libro de reclamaciones. */
  business: Business;
  contact: { eyebrow: string; title: string; lead: string };
  legalPages: Record<LegalPageKey, LegalDoc>;
  complaints: { title: string; lead: string };
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
    /** Texto de los tips (cuidados) en cada producto; vacío = no se muestra el recuadro. */
    tipsText?: string;
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
  /** Formulario de la página Contacto (/contacto). Se edita en Admin › Textos › Contacto. */
  contactForm: {
    formTitle: string;
    reasonLabel: string;
    reasons: string[];
    messageLabel: string;
    messagePlaceholder: string;
    submitLabel: string;
    footnote: string;
    sentTitle: string;
    sentLead: string;
  };
  notFound: Img & { title: string; lead: string };
  /**
   * Página "en construcción" del dominio principal mientras la tienda vive en demo.<dominio>.
   * `title`: el texto entre *asteriscos* va resaltado. `photos`: hasta 6 fotos decorativas.
   * `colors`: fija los colores de la página (fondo `ink`, botón `pink`, etc.); si faltan, salen de la paleta.
   */
  comingSoon?: {
    /** "playful" (por defecto: fondo oscuro, manchas de color, fotos flotando) o "editorial" (sobrio, sin animaciones). */
    layout?: "playful" | "editorial";
    metaDescription: string;
    tape: string;
    title: string;
    lead: string;
    photos: string[];
    /** Solo "editorial": texto del enlace a WhatsApp (se oculta si el número es un placeholder). */
    whatsappLabel?: string;
    colors?: Partial<Record<"ink" | "pink" | "teal" | "lime" | "purple" | "yellow", string>>;
  };
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
