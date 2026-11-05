import type { Catalog, Product, ProductKind, Variant } from "./types";
import { formatPrice } from "./format";

export const LOW_STOCK = 3;
/** Unidades que se pueden pedir de un producto que se vende sin control de stock. */
export const UNTRACKED_STOCK = 999;

/** false = se vende sin contar unidades. También entiende el `stockMode` de los productos del admin (vistas previas). */
export function tracksStock(p: Product & { stockMode?: "stock" | "none" }): boolean {
  return p.trackStock !== false && p.stockMode !== "none";
}

export function productKind(p: Pick<Product, "kind" | "variants">): ProductKind {
  return p.kind ?? (p.variants.length > 1 ? "options" : "simple");
}

/** El cliente tiene que elegir una opción (y cada una puede tener su precio). */
export function hasOptions(p: Pick<Product, "kind" | "variants">): boolean {
  return productKind(p) === "options" && p.variants.length > 1;
}

/** Foto a mostrar para una opción: la suya si tiene, si no la portada del producto. */
export function variantImage(p: Product, v: Variant): string {
  return v.image && p.images.includes(v.image) ? v.image : p.images[0];
}

export function isSoldOut(p: Product): boolean {
  if (p.status === "sold_out") return true;
  return tracksStock(p) && p.variants.every((v) => v.stock <= 0);
}

/** Unidades que se pueden vender de una opción (sin control de stock = sin tope práctico). */
export function unitsLeft(p: Product, v: Variant): number {
  return tracksStock(p) ? v.stock : UNTRACKED_STOCK;
}

export function minPrice(p: Product): number {
  return Math.min(...p.variants.map((v) => v.price));
}

export function totalStock(p: Product): number {
  return p.variants.reduce((s, v) => s + Math.max(0, v.stock), 0);
}

export function lineName(catalog: Catalog, lineId: string): string {
  return catalog.lines.find((l) => l.id === lineId)?.name ?? lineId;
}

export function priceLabel(p: Product, currency: string, soldOutSuffix?: string): string {
  if (isSoldOut(p)) return soldOutSuffix ? `Agotado · ${soldOutSuffix}` : "Agotado";
  const prices = p.variants.map((v) => v.price);
  const min = Math.min(...prices);
  const same = prices.every((x) => x === min);
  return `${same ? "" : "Desde "}${formatPrice(min, currency)}`;
}

/** Precio regular a mostrar tachado en la tarjeta: el de la opción más barata, si está en oferta. */
export function saleListPrice(p: Product): number | undefined {
  if (!p.variants.length) return undefined;
  const cheapest = p.variants.reduce((a, v) => (v.price < a.price ? v : a));
  return cheapest.listPrice && cheapest.listPrice > cheapest.price ? cheapest.listPrice : undefined;
}

export const onSale = (p: Product) => p.variants.some((v) => v.listPrice !== undefined && v.listPrice > v.price);

export type BadgeInfo = { text: string; cls: string } | null;

/** Badge de la tarjeta: agotado y stock bajo se calculan; el resto viene del catálogo. */
export function productBadge(p: Product): BadgeInfo {
  if (isSoldOut(p)) return { text: "Agotado", cls: "sold" };
  const stock = totalStock(p);
  if (tracksStock(p) && stock <= LOW_STOCK) return { text: `Últimas ${stock}`, cls: "low" };
  if (onSale(p)) return { text: "Oferta", cls: "new" };
  if (!p.badge) return null;
  if (/^nuevo/i.test(p.badge)) return { text: p.badge, cls: "new" };
  if (/^últim/i.test(p.badge)) return { text: p.badge, cls: "low" };
  return { text: p.badge, cls: "soft" };
}

export function variantStockLabel(v: Variant, p?: Product): string {
  const n = p ? unitsLeft(p, v) : v.stock;
  if (n <= 0) return "Agotado";
  if (n <= LOW_STOCK) return `Últimas ${n}`;
  return "";
}

export function visibleProducts(c: Catalog): Product[] {
  return c.products.filter((p) => p.status !== "draft");
}
