import type { Storefront } from "@/lib/types";

/** Secciones de Admin › Textos. Cada una edita una parte de storefront.json. */
export type TextSection = {
  id: string;
  title: string;
  where: string;
  /** La sección aparece en la vista previa de Inicio. */
  onHome: boolean;
  keys: (keyof Storefront)[];
  /** Solo si la marca tiene pedido especial (fiesta / a medida). */
  needsCustomOrder?: boolean;
};

export const TEXT_SECTIONS: TextSection[] = [
  { id: "top", title: "Anuncio y menú", where: "Todas las páginas", onHome: true, keys: ["announce", "nav"] },
  { id: "hero", title: "Portada", where: "Inicio", onHome: true, keys: ["hero"] },
  { id: "highlights", title: "Destacados y accesos", where: "Inicio", onHome: true, keys: ["highlights", "tiles"] },
  { id: "featured", title: "Productos destacados", where: "Inicio", onHome: true, keys: ["featured"] },
  { id: "partyBand", title: "Banda del pedido especial", where: "Inicio", onHome: true, keys: ["partyBand"], needsCustomOrder: true },
  { id: "inside", title: "¿Qué hay dentro?", where: "Inicio", onHome: true, keys: ["inside"] },
  { id: "models", title: "Modelos", where: "Inicio", onHome: true, keys: ["models"] },
  { id: "tips", title: "Tips", where: "Inicio", onHome: true, keys: ["tips"] },
  { id: "footer", title: "Pie de página", where: "Todas las páginas", onHome: true, keys: ["footer"] },
  { id: "business", title: "Empresa y contacto", where: "Pie de página, Contacto (/contacto), páginas legales y Libro de reclamaciones", onHome: true, keys: ["business", "contact"] },
  { id: "legalPages", title: "Términos y políticas", where: "Términos, Cambios y devoluciones, Entregas y Privacidad", onHome: false, keys: ["legalPages"] },
  { id: "complaints", title: "Libro de reclamaciones", where: "Libro de reclamaciones (/libro-de-reclamaciones)", onHome: false, keys: ["complaints"] },
  { id: "catalog", title: "Catálogo", where: "Tienda (/tienda)", onHome: false, keys: ["catalog"] },
  { id: "product", title: "Página de producto", where: "Cada producto", onHome: false, keys: ["product"] },
  { id: "cart", title: "Carrito", where: "Carrito", onHome: false, keys: ["cart"] },
  { id: "checkout", title: "Checkout", where: "Finalizar compra", onHome: false, keys: ["checkout"] },
  { id: "confirmation", title: "Confirmación", where: "Pedido confirmado", onHome: false, keys: ["confirmation"] },
  { id: "party", title: "Formulario del pedido especial", where: "Pedido especial", onHome: false, keys: ["party"], needsCustomOrder: true },
  { id: "notFound", title: "Página 404", where: "Página no encontrada", onHome: false, keys: ["notFound"] },
];

/** Claves que no son texto (o se editan en otra pantalla): no se muestran en Textos. */
export const HIDDEN_KEYS = new Set(["_note", "legal", "legalLinks", "brand", "deliveryRates", "deliveryRatesAreExample", "defaultDistrict", "productId", "max"]);

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
  contact: "Página de contacto",
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
  sizeQuestion: "Pregunta de squishies por caja",
  unsureLabel: "Opción «aún no sé»",
  name: "Nombre",
  hex: "Color",
  quantityQuestion: "Pregunta de cantidad",
  otherQuantityLabel: "Campo «otra cantidad»",
  boxQuestion: "Pregunta del tipo de caja",
  boxes: "Tipos de caja",
  sizes: "Opciones de squishies por caja",
  price: "Precio referencial por caja (S/, 0 = a cotizar)",
  extrasLabel: "Pregunta de extras",
  extrasOptions: "Opciones de extras",
  districts: "Distritos",
  commentsPlaceholder: "Ejemplo en el campo de comentarios",
  sentTitle: "Título al enviar",
  sentLead: "Texto al enviar",
  notFound: "Página 404",
};

/** Nombre de cada elemento de una lista (si no está, se usa el de la lista). */
const ITEM_LABELS: Record<string, string> = { boxes: "Caja", sizes: "Opción", sections: "Sección" };
export const itemLabelFor = (key: string) => ITEM_LABELS[key] ?? labelFor(key);

export function labelFor(key: string): string {
  if (LABELS[key]) return LABELS[key];
  const s = key.replace(/([A-Z])/g, " $1").toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const LONG_KEYS = new Set(["lead", "body", "text", "about", "footnote", "deliveryNote", "partyHint", "soldOutAllText", "soldOutVariantText", "emptyLead", "collectNote", "sentLead", "commentsPlaceholder", "giftHint"]);

export function isLong(key: string, value: string) {
  return LONG_KEYS.has(key) || value.length > 70;
}

export const isImageKey = (key: string) => key === "image";
export const isRichCandidate = (key: string) => /title|lead|text|Hint|Note|note/i.test(key);
