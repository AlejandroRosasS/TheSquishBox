/**
 * Venta paso a paso desde Telegram (/vta). Lógica pura, sin alias, para probarla con `npm test`.
 */
import type { SaleLineDraft } from "./csv";

/** Botones de canal y de pago, en el orden en que los pide el equipo. */
export const WIZARD_CHANNELS: [string, string][] = [["feria", "Feria"], ["ig", "Instagram"], ["otros", "Otros"]];
export const WIZARD_PAYS: [string, string][] = [["Efectivo", "Efectivo"], ["Yape", "Yape"], ["Tarjeta (POS)", "Tarjeta"]];

const cents = (n: number) => Math.round(n * 100);

export const linesTotal = (lines: Pick<SaleLineDraft, "price" | "qty">[]) => lines.reduce((a, l) => a + cents(l.price) * l.qty, 0) / 100;

/**
 * Reparte el monto que cobraron entre los ítems, en proporción a su precio web, para que
 * Ventas y márgenes sume exactamente lo cobrado. Si un centavo no se puede repartir parejo,
 * una unidad sale como línea aparte con el ajuste. Con otro monto los ítems dejan de contar como campaña.
 */
export function fitTotal(lines: SaleLineDraft[], total: number): SaleLineDraft[] {
  const target = cents(total);
  const web = cents(linesTotal(lines));
  if (!lines.length || target === web) return lines;
  const units = lines.reduce((a, l) => a + l.qty, 0);
  const out = lines.map((l) => {
    const unit = web > 0 ? Math.round((cents(l.price) * target) / web) : Math.round(target / units);
    return { productId: l.productId, variantId: l.variantId, qty: l.qty, price: unit / 100, ...(l.name ? { name: l.name } : {}), ...(l.cost !== undefined ? { cost: l.cost } : {}) };
  });
  const rest = target - out.reduce((a, l) => a + cents(l.price) * l.qty, 0);
  if (!rest) return out;
  // El ajuste va en una línea de 1 unidad: la última que ya tenga 1, o se separa una unidad de la última.
  const single = out.map((l) => l.qty).lastIndexOf(1);
  if (single >= 0) {
    out[single] = { ...out[single], price: (cents(out[single].price) + rest) / 100 };
    return out;
  }
  const last = out[out.length - 1];
  out[out.length - 1] = { ...last, qty: last.qty - 1 };
  out.push({ ...last, qty: 1, price: (cents(last.price) + rest) / 100 });
  return out;
}

/** Junta la misma opción en una sola línea (si eligen dos veces el mismo producto). */
export function addLine(lines: SaleLineDraft[], line: SaleLineDraft): SaleLineDraft[] {
  const i = lines.findIndex((l) => l.productId === line.productId && l.variantId === line.variantId && l.price === line.price && l.name === line.name);
  if (i < 0) return [...lines, line];
  return lines.map((l, j) => (j === i ? { ...l, qty: Math.min(999, l.qty + line.qty) } : l));
}
