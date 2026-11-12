import type { Storefront } from "@/lib/types";

/** Secciones de Admin › Textos. Cada una edita una parte de storefront.json. */
export type TextSection = {
  id: string;
  title: string;
  where: string;
  /** La sección aparece en la vista previa de Inicio. */
  onHome: boolean;
  keys: (keyof Storefront)[];
  /** Aclaración que se muestra arriba de los campos. */
  note?: string;
  /** Solo si la marca tiene pedido especial (fiesta / a medida). */
  needsCustomOrder?: boolean;
  /** Solo para marcas con ese tipo de formulario (customOrder.form). */
  form?: "party" | "contact";
};

export const TEXT_SECTIONS: TextSection[] = [
  { id: "top", title: "Anuncio y menú", where: "Todas las páginas", onHome: true, keys: ["announce", "nav"] },
  { id: "hero", title: "Portada", where: "Inicio", onHome: true, keys: ["hero"] },
  { id: "highlights", title: "Destacados y accesos", where: "Inicio, debajo de la portada", onHome: true, keys: ["highlights", "tiles"], note: "Destacados: los círculos tipo historias de Instagram. Accesos: las fotos grandes que llevan a cada línea de productos." },
  { id: "featured", title: "Productos destacados", where: "Inicio", onHome: true, keys: ["featured"] },
  { id: "partyBand", title: "Banda del pedido especial", where: "Inicio", onHome: true, keys: ["partyBand"], needsCustomOrder: true },
  { id: "inside", title: "¿Qué hay dentro?", where: "Inicio", onHome: true, keys: ["inside"] },
  { id: "models", title: "Modelos", where: "Inicio", onHome: true, keys: ["models"], note: "Las fotos del recuadro se cambian aquí abajo, en «Fotos del recuadro». Puedes agregar, quitar y ordenar fotos." },
  { id: "tips", title: "Tips", where: "Inicio", onHome: true, keys: ["tips"] },
  { id: "footer", title: "Pie de página", where: "Todas las páginas", onHome: true, keys: ["footer"] },
  { id: "contactForm", title: "Contacto y empresa", where: "Contacto (/contacto); los datos de la empresa también en el pie, páginas legales y Libro de reclamaciones", onHome: false, keys: ["business", "contact", "contactForm"], note: "Datos de la empresa: WhatsApp, correo, dirección y horario se ven en Contacto; razón social, RUC y dirección también en el pie de página (lo que piden Culqi e INDECOPI). Los mensajes del formulario llegan a Pedidos con la etiqueta «Contacto» y avisan por los canales prendidos en Notificaciones. «Motivos para elegir» son las opciones del selector «Motivo»." },
  { id: "legalPages", title: "Términos y políticas", where: "Términos, Cambios y devoluciones, Entregas y Privacidad", onHome: false, keys: ["legalPages"] },
  { id: "complaints", title: "Libro de reclamaciones", where: "Libro de reclamaciones (/libro-de-reclamaciones)", onHome: false, keys: ["complaints"] },
  { id: "catalog", title: "Catálogo", where: "Tienda (/tienda)", onHome: false, keys: ["catalog"] },
  { id: "product", title: "Página de producto", where: "Cada producto", onHome: false, keys: ["product"] },
  { id: "cart", title: "Carrito", where: "Carrito", onHome: false, keys: ["cart"] },
  { id: "checkout", title: "Checkout", where: "Finalizar compra", onHome: false, keys: ["checkout"] },
  { id: "confirmation", title: "Confirmación", where: "Pedido confirmado", onHome: false, keys: ["confirmation"] },
  { id: "party", title: "Formulario del pedido especial", where: "Pedido especial", onHome: false, keys: ["party"], needsCustomOrder: true, form: "party" },
  { id: "notFound", title: "Página 404", where: "Página no encontrada", onHome: false, keys: ["notFound"] },
];

/** Claves que no son texto (o se editan en otra pantalla): no se muestran en Textos. */
export const HIDDEN_KEYS = new Set(["_note", "legal", "legalLinks", "brand", "deliveryRates", "deliveryRatesAreExample", "defaultDistrict", "productId", "max", "hidden"]);

/** Claves que guardan ids de productos: se editan con casillas. */
export const PRODUCT_LIST_KEYS = new Set(["productIds", "popularIds"]);

const LABELS: Record<string, string> = {
  announce: "Barra de anuncio",
  nav: "Menú principal",
  hero: "Portada",
  eyebrow: "Antetítulo",
  title: "Título",
  lead: "Bajada",
  body: "Texto",
  image: "Foto",
  alt: "Descripción de la foto",
  imageAlt: "Descripción de la foto",
  primaryCta: "Botón principal",
  secondaryCta: "Botón secundario",
  label: "Texto",
  href: "Enlace",
  highlights: "Destacados (círculos tipo historias)",
  tiles: "Accesos por línea",
  featured: "Productos destacados",
  productIds: "Productos que se muestran",
  viewAll: "Link «ver todo» (computadora)",
  viewAllMobile: "Botón «ver todo» (celular)",
  partyBand: "Banda del pedido especial",
  steps: "Pasos",
  cta: "Botón",
  inside: "¿Qué hay dentro?",
  models: "Modelos que te pueden tocar",
  footnote: "Nota al pie",
  photos: "Fotos del recuadro",
  tips: "Tips",
  items: "Tips",
  text: "Texto",
  footer: "Pie de página",
  about: "Sobre la marca",
  shop: "Columna «Tienda»",
  help: "Columna «Ayuda»",
  business: "Datos de la empresa",
  legalName: "Razón social",
  ruc: "RUC",
  address: "Dirección (la del RUC)",
  email: "Correo de atención",
  phone: "Teléfono / WhatsApp",
  hours: "Horario de atención",
  contact: "Encabezado de la página",
  legalPages: "Páginas legales",
  terms: "Términos y condiciones",
  returns: "Cambios y devoluciones",
  shipping: "Entregas",
  privacy: "Privacidad",
  sections: "Secciones",
  complaints: "Libro de reclamaciones",
  catalog: "Catálogo",
  allLabel: "Filtro «todas»",
  priceRanges: "Rangos de precio",
  min: "Desde (S/)",
  max: "Hasta (S/)",
  partyCta: "Recuadro del pedido especial",
  product: "Producto",
  variantQuestion: "Pregunta para elegir variante",
  partyHint: "Sugerencia del pedido especial",
  deliveryNote: "Nota de entrega",
  tipsTitle: "Título de los tips",
  soldOutAllText: "Texto cuando está agotado",
  soldOutVariantText: "Texto cuando una variante está agotada",
  moreTitle: "Título «más productos»",
  cart: "Carrito",
  emptyTitle: "Título del carrito vacío",
  emptyLead: "Texto del carrito vacío",
  emptyPrimary: "Botón principal (carrito vacío)",
  emptySecondary: "Botón secundario (carrito vacío)",
  popularTitle: "Título «los más pedidos»",
  popularIds: "Productos «los más pedidos»",
  checkout: "Checkout",
  deliveryLabel: "Opción delivery",
  pickupLabel: "Opción recojo",
  pickupNote: "Nota del recojo",
  giftHint: "Ayuda del mensaje de regalo",
  confirmation: "Confirmación",
  collectNote: "Nota final",
  party: "Pedido especial",
  quantities: "Cantidades para elegir",
  defaultQuantity: "Cantidad marcada al inicio",
  sizeQuestion: "Pregunta de opciones por tipo",
  unsureLabel: "Opción «aún no sé»",
  name: "Nombre",
  hex: "Color",
  quantityQuestion: "Pregunta de cantidad",
  otherQuantityLabel: "Campo «otra cantidad»",
  boxQuestion: "Pregunta del tipo",
  boxes: "Tipos (caja, arreglo…)",
  sizes: "Opciones de cada tipo",
  price: "Precio referencial (S/, 0 = a cotizar)",
  extrasLabel: "Pregunta de extras",
  extrasOptions: "Opciones de extras",
  districts: "Distritos",
  commentsPlaceholder: "Ejemplo en el campo de comentarios",
  sentTitle: "Título al enviar",
  sentLead: "Texto al enviar",
  notFound: "Página 404",
  contactForm: "Formulario",
  formTitle: "Título del formulario",
  reasonLabel: "Pregunta del motivo",
  reasons: "Motivos para elegir",
  messageLabel: "Campo del mensaje",
  messagePlaceholder: "Ejemplo en el campo del mensaje",
  submitLabel: "Botón de enviar",
};

/** Nombre de cada elemento de una lista (si no está, se usa el de la lista). */
const ITEM_LABELS: Record<string, string> = { boxes: "Caja", sizes: "Opción", sections: "Sección", photos: "Foto", highlights: "Círculo", tiles: "Acceso", items: "Tip", steps: "Paso", reasons: "Motivo" };
export const itemLabelFor = (key: string) => ITEM_LABELS[key] ?? labelFor(key);

export function labelFor(key: string): string {
  if (LABELS[key]) return LABELS[key];
  const s = key.replace(/([A-Z])/g, " $1").toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const LONG_KEYS = new Set(["lead", "body", "text", "about", "footnote", "deliveryNote", "partyHint", "soldOutAllText", "soldOutVariantText", "emptyLead", "collectNote", "sentLead", "commentsPlaceholder", "messagePlaceholder", "giftHint"]);

export function isLong(key: string, value: string) {
  return LONG_KEYS.has(key) || value.length > 70;
}

export const isImageKey = (key: string) => key === "image";
export const isRichCandidate = (key: string) => /title|lead|text|Hint|Note|note/i.test(key);

/**
 * Etiqueta HTML/SEO con la que la tienda publica cada campo de Textos.
 * Clave: ruta dentro de storefront con los índices de listas como `*` (ej. "tips.items.*.title").
 * Debe seguir a los componentes de la tienda (HomeView, ContactView, LegalView…): si cambia
 * el HTML de una página, actualiza aquí su etiqueta.
 */
export type SeoTag = { tags: string[]; hint?: string };

const H1 = "Título principal de la página (H1): lo primero que Google lee para saber de qué trata. Hay uno solo por página.";
const H2 = "Subtítulo de sección (H2): ayuda a Google a entender las partes de la página.";
const ALT = "Texto alternativo (alt): lo leen Google Imágenes y los lectores de pantalla. Describe lo que se ve.";
const TITLE_TAG = "También es el título de la pestaña y del resultado en Google (<title>).";
const META = "También es la meta description: el texto gris debajo del título en Google.";
const LINK = "Texto del enlace (<a>): dice a Google a qué página lleva.";
const NOT_META = "Párrafo visible (<p>). La meta description de Inicio se edita en Admin › SEO.";

const p = (hint?: string): SeoTag => ({ tags: ["p"], hint });
const h = (n: 1 | 2 | 3 | 4, hint?: string): SeoTag => ({ tags: [`h${n}`], hint });
const a: SeoTag = { tags: ["a"], hint: LINK };
const alt: SeoTag = { tags: ["alt"], hint: ALT };
const eyebrow = p("Texto chico arriba del título (<p>, no es encabezado).");

const SEO_TAGS: Record<string, SeoTag> = {
  "nav.*.label": { tags: ["a", "nav"], hint: "Enlace del menú principal (<nav>)." },
  "hero.eyebrow": eyebrow,
  "hero.title": h(1, H1),
  "hero.lead": p(NOT_META),
  "hero.alt": { tags: ["alt"], hint: `${ALT} Es la foto más importante de Inicio.` },
  "hero.primaryCta.label": a,
  "hero.secondaryCta.label": a,
  "highlights.*.label": a,
  "tiles.*.alt": alt,
  "tiles.*.eyebrow": { tags: ["span"], hint: "Va dentro del enlace del acceso; no es encabezado." },
  "tiles.*.title": { tags: ["span", "a"], hint: "Se ve grande pero no es encabezado: es el texto del enlace del acceso." },
  "featured.eyebrow": eyebrow,
  "featured.title": h(2, H2),
  "featured.viewAll": a,
  "featured.viewAllMobile": a,
  "partyBand.eyebrow": eyebrow,
  "partyBand.title": h(2, H2),
  "partyBand.lead": p(),
  "partyBand.alt": alt,
  "partyBand.steps": { tags: ["li"], hint: "Lista numerada (<ol>)." },
  "partyBand.cta": a,
  "inside.eyebrow": eyebrow,
  "inside.title": h(2, H2),
  "inside.lead": p(),
  "inside.body": p(),
  "inside.alt": alt,
  "models.eyebrow": eyebrow,
  "models.title": h(2, H2),
  "models.footnote": p(),
  "models.photos.*.alt": { tags: ["alt"], hint: `${ALT} Pon el nombre del modelo.` },
  "tips.eyebrow": eyebrow,
  "tips.title": h(2, H2),
  "tips.items.*.title": h(3),
  "tips.items.*.text": p(),
  "footer.about": p(),
  "footer.shop.*.label": a,
  "footer.help.*.label": a,
  "contact.eyebrow": { tags: ["p", "title"], hint: `Texto chico arriba del título. ${TITLE_TAG}` },
  "contact.title": h(1, H1),
  "contact.lead": { tags: ["p", "meta description"], hint: META },
  "contactForm.formTitle": h(2),
  "contactForm.sentTitle": h(2),
  "contactForm.sentLead": p(),
  "contactForm.footnote": p(),
  "legalPages.*.title": { tags: ["h1", "title"], hint: `${H1} ${TITLE_TAG}` },
  "legalPages.*.lead": { tags: ["p", "meta description"], hint: META },
  "legalPages.*.sections.*.title": h(2, H2),
  "legalPages.*.sections.*.text": p(),
  "complaints.title": { tags: ["h1", "title"], hint: `${H1} ${TITLE_TAG}` },
  "complaints.lead": { tags: ["p", "meta description"], hint: META },
  "catalog.title": h(1, H1),
  "catalog.lead": p("Párrafo visible (<p>). La meta description de la tienda se edita en Admin › SEO."),
  "catalog.partyCta.title": p("Se ve como título pero es un párrafo (<p>)."),
  "catalog.partyCta.text": p(),
  "catalog.partyCta.cta": a,
  "product.moreTitle": h(2),
  "product.tipsTitle": h(3),
  "cart.emptyTitle": { tags: ["h1"], hint: "Título del carrito vacío. El carrito no aparece en Google (noindex)." },
  "cart.emptyLead": p(),
  "cart.popularTitle": h(2),
  "cart.emptyPrimary.label": a,
  "cart.emptySecondary.label": a,
  "confirmation.title": { tags: ["h1"], hint: "Página privada del pedido: no aparece en Google (noindex)." },
  "confirmation.lead": p(),
  "party.eyebrow": eyebrow,
  "party.title": h(1, H1),
  "party.lead": p(),
  "party.imageAlt": alt,
  "party.sentTitle": h(1),
  "party.sentLead": p(),
  "notFound.title": { tags: ["h1"], hint: "Título de la página 404 (Google no la indexa)." },
  "notFound.lead": p(),
  "notFound.alt": alt,
};

/** Etiqueta HTML/SEO del campo en `path` (ej. "hero.title" → h1). */
export function seoTagFor(path: string): SeoTag | undefined {
  const norm = path.replace(/\.\d+(?=\.|$)/g, ".*");
  return SEO_TAGS[norm] ?? SEO_TAGS[norm.replace(/\.\*$/, "")];
}

/** Campos que también salen como <title> o meta description (su largo cuenta en Google). */
const LIMITS: Record<string, number> = { title: 60, "meta description": 160 };

/** Aviso de SEO para el valor de un campo, o null si está bien. */
export function seoWarning(tag: SeoTag | undefined, value: string): string | null {
  if (!tag) return null;
  const v = value.trim();
  if (tag.tags.includes("h1") && !v) return "Sin H1 la página pierde su título principal para Google.";
  if (tag.tags.includes("alt") && !v) return "Sin descripción, Google no sabe qué muestra la foto.";
  for (const t of ["title", "meta description"]) {
    if (tag.tags.includes(t) && v.length > LIMITS[t]) return `Google suele cortar el ${t === "title" ? "título" : "texto"} después de ${LIMITS[t]} caracteres (tiene ${v.length}).`;
  }
  return null;
}
