/**
 * Cotizador: costo de una receta (insumos al costo promedio + merma esperada + extras) y precio sugerido
 * según las reglas de precio de la marca (margen objetivo o multiplicador, IGV opcional, redondeo).
 */
import type { Supply } from "./inventory";

export type Rounding = "none" | "sol" | "9" | "10";
/** `igvRate` (%): no se guarda con las reglas; viene de Ajustes › Comisiones e IGV (un solo lugar para la tasa). */
export type PricingRules = { mode: "margin" | "multiplier"; margin: number; multiplier: number; rounding: Rounding; igv: boolean; igvRate?: number };
/** Sin datos de la marca: margen 50 %, sin IGV, redondeo al sol. La marca lo cambia en Cotizador. */
export const DEFAULT_RULES: PricingRules = { mode: "margin", margin: 50, multiplier: 3, rounding: "sol", igv: false };
/** Tasa por defecto si la marca no la configuró (Perú, 18 %). */
export const IGV = 0.18;
const igvOf = (r: Pick<PricingRules, "igvRate">) => (r.igvRate === undefined ? IGV : r.igvRate / 100);
export const ROUNDING_LABEL: Record<Rounding, string> = { none: "Sin redondeo", sol: "Al sol", "9": "Terminar en 9", "10": "De 10 en 10" };

export type RecipeLine = { supply: string; qty: number; /** Nombre de la parte opcional, p. ej. «Con florero». */ optional?: string };
export type Recipe = { product: string; variant: string; lines: RecipeLine[]; extraCost: number };
export const recipeKey = (product: string, variant: string) => `${product}\u0000${variant}`;

export type QuoteLine =
  | { kind: "recipe"; product: string; variant: string; name: string; qty: number; optionals: string[] }
  | { kind: "supply"; supply: string; name: string; qty: number };
export type QuoteStatus = "open" | "accepted" | "lost";
export type Quote = {
  id: string;
  title: string;
  client: string;
  lines: QuoteLine[];
  extraCost: number;
  cost: number;
  suggested: number;
  price: number;
  validUntil: string | null;
  status: QuoteStatus;
  note: string;
  createdAt: string;
};
export const QUOTE_STATUS: Record<QuoteStatus, string> = { open: "Abierta", accepted: "Aceptada", lost: "No se concretó" };

const r2 = (n: number) => Math.round(n * 100) / 100;

export type CostRow = { supplyId: string; name: string; unit: string; qty: number; unitCost: number; cost: number; waste: number; optional?: string };
export type CostBreakdown = { rows: CostRow[]; supplies: number; waste: number; extra: number; total: number; missing: string[] };

/**
 * Suma insumos (cantidad × costo promedio) y su merma esperada (% del insumo).
 * `withOptionals`: qué partes opcionales entran. `missing`: insumos sin costo todavía (sin compras).
 */
export function costOf(
  lines: { supply: string; qty: number; optional?: string }[],
  supplies: Map<string, Supply>,
  avgCost: (id: string) => number,
  opts: { extra?: number; withOptionals?: string[] | "all" } = {},
): CostBreakdown {
  const rows: CostRow[] = [];
  const missing: string[] = [];
  for (const l of lines) {
    if (l.optional && opts.withOptionals !== "all" && !(opts.withOptionals ?? []).includes(l.optional)) continue;
    const s = supplies.get(l.supply);
    if (!s) continue;
    const unitCost = avgCost(s.id);
    if (!unitCost && !missing.includes(s.name)) missing.push(s.name);
    const cost = l.qty * unitCost;
    rows.push({ supplyId: s.id, name: s.name, unit: s.unit, qty: l.qty, unitCost, cost: r2(cost), waste: r2(cost * (s.wastePct ?? 0) / 100), optional: l.optional });
  }
  const sum = rows.reduce((n, r) => n + r.cost, 0);
  const waste = rows.reduce((n, r) => n + r.waste, 0);
  const extra = opts.extra ?? 0;
  return { rows, supplies: r2(sum), waste: r2(waste), extra: r2(extra), total: r2(sum + waste + extra), missing };
}

/** Redondea hacia arriba (nunca baja el precio por debajo de lo calculado). */
export function roundPrice(n: number, r: Rounding): number {
  if (n <= 0) return 0;
  const c = Math.round(n * 100) / 100;
  if (r === "sol") return Math.ceil(c - 1e-9);
  if (r === "10") return Math.ceil(c / 10 - 1e-9) * 10;
  if (r === "9") {
    const up = Math.ceil(c - 1e-9);
    return up % 10 === 9 ? up : up + ((9 - (up % 10) + 10) % 10);
  }
  return r2(c);
}

/** Precio sugerido a partir del costo. Margen: costo / (1 − margen). Multiplicador: costo × N. Luego IGV y redondeo. */
export function suggestedPrice(cost: number, rules: PricingRules): { base: number; withIgv: number; price: number } {
  const m = Math.min(Math.max(rules.margin, 0), 95) / 100;
  const base = rules.mode === "margin" ? cost / (1 - m) : cost * Math.max(rules.multiplier, 0);
  const withIgv = rules.igv ? base * (1 + igvOf(rules)) : base;
  return { base: r2(base), withIgv: r2(withIgv), price: roundPrice(withIgv, rules.rounding) };
}

/** Margen real de un precio de venta (sin IGV si las reglas lo incluyen): (precio − costo) / precio. */
export function realMargin(price: number, cost: number, rules: Pick<PricingRules, "igv" | "igvRate">): number | null {
  const net = rules.igv ? price / (1 + igvOf(rules)) : price;
  return net > 0 ? Math.round(((net - cost) / net) * 1000) / 10 : null;
}

export function normalizeRules(v: unknown): PricingRules {
  const o = (v && typeof v === "object" ? v : {}) as Partial<PricingRules>;
  return {
    mode: o.mode === "multiplier" ? "multiplier" : "margin",
    margin: typeof o.margin === "number" && o.margin >= 0 && o.margin < 100 ? o.margin : DEFAULT_RULES.margin,
    multiplier: typeof o.multiplier === "number" && o.multiplier > 0 ? o.multiplier : DEFAULT_RULES.multiplier,
    rounding: o.rounding && o.rounding in ROUNDING_LABEL ? o.rounding : DEFAULT_RULES.rounding,
    igv: o.igv === true,
  };
}
