/**
 * Inventario: proveedores, insumos y movimientos. Módulo genérico de la plataforma (se activa por marca).
 * El stock y el costo promedio ponderado se calculan repasando los movimientos en orden: el historial
 * es la única fuente de verdad (ver supabase/migrations/0011_inventory.sql).
 */
import type { PricingRules, Quote, Recipe } from "./pricing";

export type SupplierOrigin = "nacional" | "importado";
export type Supplier = { id: string; name: string; origin: SupplierOrigin; leadDays: number | null; contact: string; note: string; archived: boolean };

/** 1 `name` = `factor` unidades de uso. */
export type PurchaseUnit = { name: string; factor: number };
export type Supply = {
  id: string;
  name: string;
  category: string;
  /** Unidad de uso: la del stock y de las recetas (tallo, vara, pliego, unidad…). */
  unit: string;
  purchaseUnits: PurchaseUnit[];
  minStock: number | null;
  shelfDays: number | null;
  wastePct: number | null;
  photos: string[];
  note: string;
  archived: boolean;
};

export type MovementKind = "purchase" | "waste" | "adjust" | "use" | "sale";
export type Movement = {
  id: string;
  supplyId: string;
  kind: MovementKind;
  /** En unidades de uso: + entra, − sale. En compras, las unidades buenas que entraron. */
  qty: number;
  /** Solo compras: monto total pagado. */
  amount?: number;
  supplierId?: string;
  purchaseQty?: number;
  purchaseUnit?: string;
  /** Solo compras: unidades de uso que llegaron malas. */
  badQty?: number;
  receipt?: string;
  /** Solo salidas por cotización (kind "sale"): la cotización que se descontó. */
  quoteId?: string;
  note: string;
  /** AAAA-MM-DD (hora de Perú). */
  day: string;
  createdAt: string;
};

export type InventoryData = {
  enabled: boolean;
  suppliers: Supplier[];
  supplies: Supply[];
  movements: Movement[];
  pricing: PricingRules;
  recipes: Recipe[];
  quotes: Quote[];
};
export const EMPTY_INVENTORY: InventoryData = { enabled: false, suppliers: [], supplies: [], movements: [], // Mismo valor que DEFAULT_RULES en pricing.ts (aquí literal para no importar código en las pruebas).
  pricing: { mode: "margin", margin: 50, multiplier: 3, rounding: "sol", igv: false }, recipes: [], quotes: [] };

export const KIND_LABEL: Record<MovementKind, string> = { purchase: "Compra", waste: "Merma", adjust: "Ajuste por conteo", use: "Uso interno", sale: "Salida por cotización" };

export type PurchaseInfo = { day: string; supplierId?: string; unitCost: number; qty: number; amount: number };
export type SupplierPrice = { supplierId: string; last: PurchaseInfo; avgUnitCost: number; purchases: number; units: number };
export type SupplyState = {
  stock: number;
  /** Costo promedio ponderado por unidad de uso (0 si nunca hubo compras). */
  avgCost: number;
  /** Valor del stock al costo promedio. */
  value: number;
  last?: PurchaseInfo;
  bySupplier: SupplierPrice[];
  /** Valor de la merma (al recibir + posterior) en los últimos 30 días. */
  wasteValue30: number;
  low: boolean;
};

const r2 = (n: number) => Math.round(n * 100) / 100;
const r3 = (n: number) => Math.round(n * 1000) / 1000;
const byTime = (a: Movement, b: Movement) => a.day.localeCompare(b.day) || a.createdAt.localeCompare(b.createdAt);

/** Repasa los movimientos de un insumo y devuelve stock, costo promedio, última compra y precios por proveedor. */
export function supplyState(supply: Supply, movements: Movement[], today: string): SupplyState {
  const mine = movements.filter((m) => m.supplyId === supply.id).sort(byTime);
  const since = shiftDay(today, -30);
  let stock = 0;
  let avg = 0;
  let wasteValue30 = 0;
  let last: PurchaseInfo | undefined;
  const sup = new Map<string, { last: PurchaseInfo; amount: number; units: number; purchases: number }>();
  for (const m of mine) {
    if (m.kind === "purchase") {
      const amount = m.amount ?? 0;
      const base = Math.max(stock, 0);
      const good = Math.max(m.qty, 0);
      if (base + good > 0) avg = (base * avg + amount) / (base + good);
      stock += good;
      // Lo que llegó malo ya está dentro del costo (encarece a los buenos); se cuenta como merma del período.
      const unitCost = good > 0 ? amount / good : 0;
      if (m.badQty && m.day >= since) wasteValue30 += m.badQty * ((m.qty + m.badQty) > 0 ? amount / (m.qty + m.badQty) : 0);
      last = { day: m.day, supplierId: m.supplierId, unitCost, qty: good, amount };
      if (m.supplierId) {
        const s = sup.get(m.supplierId) ?? { last, amount: 0, units: 0, purchases: 0 };
        sup.set(m.supplierId, { last, amount: s.amount + amount, units: s.units + good, purchases: s.purchases + 1 });
      }
    } else {
      if (m.kind === "waste" && m.qty < 0 && m.day >= since) wasteValue30 += -m.qty * avg;
      stock += m.qty;
    }
  }
  stock = r3(stock);
  return {
    stock,
    avgCost: r2(avg),
    value: r2(Math.max(stock, 0) * avg),
    last,
    bySupplier: [...sup.entries()]
      .map(([supplierId, s]) => ({ supplierId, last: s.last, avgUnitCost: s.units ? s.amount / s.units : 0, purchases: s.purchases, units: s.units }))
      .sort((a, b) => b.last.day.localeCompare(a.last.day)),
    wasteValue30: r2(wasteValue30),
    low: supply.minStock !== null && stock <= supply.minStock,
  };
}

export function shiftDay(day: string, days: number): string {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Cantidad (sin ceros de más): 12, 2.5, 0.125 */
export const qtyLabel = (n: number) => String(r3(n));
/** «12 tallos» con plural simple en español. */
export function unitsLabel(n: number, unit: string) {
  const q = qtyLabel(n);
  if (Math.abs(n) === 1 || !unit) return `${q} ${unit}`.trim();
  const plural = /[aeiouáéó]$/i.test(unit) ? `${unit}s` : /[sx]$/i.test(unit) ? unit : `${unit}es`;
  return `${q} ${plural}`;
}

/** Datos de una compra escrita en el formulario → movimiento. Devuelve un error legible si algo falta. */
export function purchaseMovement(
  input: { supply: Supply; purchaseQty: number; unitName: string; badQty: number; amount: number; supplierId?: string; day: string; note: string; receipt?: string },
  ids: { id: string; createdAt: string },
): Movement | string {
  const factor = input.unitName === input.supply.unit ? 1 : input.supply.purchaseUnits.find((u) => u.name === input.unitName)?.factor;
  if (!factor) return "Elige la unidad en que compraste";
  if (!(input.purchaseQty > 0)) return "Escribe cuánto compraste";
  if (!(input.amount >= 0)) return "Escribe cuánto pagaste";
  const total = input.purchaseQty * factor;
  if (input.badQty < 0 || input.badQty > total) return `Las unidades malas no pueden pasar de ${unitsLabel(total, input.supply.unit)}`;
  return {
    ...ids,
    supplyId: input.supply.id,
    kind: "purchase",
    qty: r3(total - input.badQty),
    amount: r2(input.amount),
    supplierId: input.supplierId || undefined,
    purchaseQty: input.purchaseQty,
    purchaseUnit: input.unitName,
    badQty: input.badQty || undefined,
    receipt: input.receipt,
    note: input.note.trim(),
    day: input.day,
  };
}

export const newId = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `i${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`);
