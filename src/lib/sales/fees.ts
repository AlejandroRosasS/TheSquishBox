/**
 * IGV y comisiones por medio de pago, configurables por marca (Admin › Ajustes › Comisiones e IGV).
 * Se guardan en site_docs kind 'settings' (stage 'published', solo lo ve el equipo) bajo `paymentFees`.
 *
 * Cada medio de pago tiene su propia regla, así mañana Yape puede tener comisión o el efectivo IGV
 * sin tocar el código: basta con activarlo en el admin.
 */
/** Minúsculas y sin tildes, para reconocer el medio de pago escrito a mano. */
const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

export type PayMethodKey = "card_web" | "card_pos" | "yape" | "plin" | "efectivo" | "transferencia";

/** `pct`: comisión en % del monto cobrado. `fixed`: monto fijo por operación (S/). `igv`: el precio incluye IGV y se descuenta. */
export type FeeRule = { igv: boolean; pct: number; fixed: number };
export type PaymentFees = { igvRate: number; rules: Record<PayMethodKey, FeeRule> };

export const PAY_METHOD_LABELS: [PayMethodKey, string, string][] = [
  ["card_web", "Tarjeta en la web", "Cobros con Culqi en la tienda online"],
  ["card_pos", "Tarjeta con POS", "Ventas externas (ferias, Instagram) cobradas con tu POS"],
  ["yape", "Yape", ""],
  ["plin", "Plin", ""],
  ["efectivo", "Efectivo", ""],
  ["transferencia", "Transferencia", ""],
];

const OFF: FeeRule = { igv: false, pct: 0, fixed: 0 };
/** Por defecto solo las tarjetas descuentan IGV. Las comisiones quedan en 0 hasta que la marca ponga las suyas. */
export const DEFAULT_FEES: PaymentFees = {
  igvRate: 18,
  rules: { card_web: { igv: true, pct: 0, fixed: 0 }, card_pos: { igv: true, pct: 0, fixed: 0 }, yape: OFF, plin: OFF, efectivo: OFF, transferencia: OFF },
};

const num = (v: unknown, max: number) => {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? ""));
  return Number.isFinite(n) && n >= 0 ? Math.min(n, max) : 0;
};

/** Lo guardado (puede venir incompleto o de una versión anterior) → configuración completa. */
export function normalizeFees(raw: unknown): PaymentFees {
  const r = (raw ?? {}) as { igvRate?: unknown; rules?: Record<string, Partial<FeeRule>> };
  const rules = { ...DEFAULT_FEES.rules };
  for (const [k] of PAY_METHOD_LABELS) {
    const x = r.rules?.[k];
    if (x) rules[k] = { igv: typeof x.igv === "boolean" ? x.igv : DEFAULT_FEES.rules[k].igv, pct: num(x.pct, 100), fixed: num(x.fixed, 10_000) };
  }
  return { igvRate: r.igvRate === undefined ? DEFAULT_FEES.igvRate : num(r.igvRate, 100), rules };
}

/**
 * Medio de pago de una venta → regla. Web: `payment_method` de la base (`tarjeta`, `yape`…).
 * Externas: el texto de la venta manual («Tarjeta (POS)», «Yape», «Tarjeta» del bot…).
 */
export function payMethodKey(pay: string | undefined, channel: string): PayMethodKey | null {
  const n = norm(pay ?? "");
  if (!n) return null;
  if (n.includes("tarjeta") || n.includes("pos") || n.includes("visa") || n.includes("culqi") || n.includes("credito") || n.includes("debito"))
    return channel === "web" ? "card_web" : "card_pos";
  if (n.includes("yape")) return "yape";
  if (n.includes("plin")) return "plin";
  if (n.includes("efectivo") || n.includes("cash")) return "efectivo";
  if (n.includes("transfer") || n.includes("deposito")) return "transferencia";
  return null;
}

export type Deductions = { igv: number; fee: number };
const ZERO: Deductions = { igv: 0, fee: 0 };
const r2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Lo que se descuenta de un monto cobrado: el IGV que va dentro del precio (monto − monto / 1.18)
 * y la comisión (% del monto cobrado + fijo por operación si `withFixed`).
 */
export function deductions(amount: number, rule: FeeRule | null, igvRate: number, withFixed: boolean): Deductions {
  if (!rule || amount <= 0) return ZERO;
  const igv = rule.igv && igvRate > 0 ? amount - amount / (1 + igvRate / 100) : 0;
  const fee = (amount * rule.pct) / 100 + (withFixed ? rule.fixed : 0);
  return { igv: r2(igv), fee: r2(fee) };
}

/** ¿La marca ya puso alguna comisión o IGV? Para avisar en Ventas si falta configurar. */
export function feesConfigured(f: PaymentFees, key: PayMethodKey) {
  const r = f.rules[key];
  return r.pct > 0 || r.fixed > 0;
}
