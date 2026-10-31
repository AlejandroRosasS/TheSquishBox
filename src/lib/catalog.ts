import type { Catalog, Product, Variant } from "./types";
import { formatPrice } from "./format";

export const LOW_STOCK = 3;

export function isSoldOut(p: Product): boolean {
  return p.status === "sold_out" || p.variants.every((v) => v.stock <= 0);
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

export type BadgeInfo = { text: string; cls: string } | null;

/** Badge de la tarjeta: agotado y stock bajo se calculan; el resto viene del catálogo. */
export function productBadge(p: Product): BadgeInfo {
  if (isSoldOut(p)) return { text: "Agotado", cls: "sold" };
  const stock = totalStock(p);
  if (stock <= LOW_STOCK) return { text: `Últimas ${stock}`, cls: "low" };
  if (!p.badge) return null;
  if (/^nuevo/i.test(p.badge)) return { text: p.badge, cls: "new" };
  if (/^últim/i.test(p.badge)) return { text: p.badge, cls: "low" };
  return { text: p.badge, cls: "soft" };
}

export function variantStockLabel(v: Variant): string {
  if (v.stock <= 0) return "Agotado";
  if (v.stock <= LOW_STOCK) return `Últimas ${v.stock}`;
  return "";
}

export function visibleProducts(c: Catalog): Product[] {
  return c.products.filter((p) => p.status !== "draft");
}
