import type { Storefront } from "./types";

/**
 * Envíos y cambios de la marca (Admin › Textos › Envíos y cambios). Son la fuente de:
 * - los datos que Google lee de cada producto (shippingDetails y hasMerchantReturnPolicy del JSON-LD),
 * - las variables {deliveryDaysMin}, {deliveryDaysMax} y {returnDays} de las páginas Entregas y Cambios.
 * Días de preparación y de traslado en días hábiles; días de cambio en días calendario.
 */
export type Policies = {
  handlingDaysMin: number;
  handlingDaysMax: number;
  transitDaysMin: number;
  transitDaysMax: number;
  /** Código ISO 3166-2 (sin el país) de la zona de entrega, ej. "LMA" = Lima Metropolitana. Vacío = todo el país. */
  shipRegion: string;
  /** false = la marca no acepta cambios ni devoluciones. */
  returnsAccepted: boolean;
  returnDays: number;
  customerPaysReturnShipping: boolean;
};

export const DEFAULT_POLICIES: Policies = {
  handlingDaysMin: 0,
  handlingDaysMax: 1,
  transitDaysMin: 1,
  transitDaysMax: 2,
  shipRegion: "",
  returnsAccepted: true,
  returnDays: 7,
  customerPaysReturnShipping: true,
};

const days = (v: unknown, fallback: number) => {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? ""));
  return Number.isFinite(n) && n >= 0 ? Math.min(Math.round(n), 365) : fallback;
};

/** Lo guardado (puede venir incompleto o con números escritos a mano) → valores válidos y ordenados (mín ≤ máx). */
export function policiesOf(sf: Pick<Storefront, "policies">): Policies {
  const r = { ...DEFAULT_POLICIES, ...(sf.policies ?? {}) };
  const hMin = days(r.handlingDaysMin, DEFAULT_POLICIES.handlingDaysMin);
  const tMin = days(r.transitDaysMin, DEFAULT_POLICIES.transitDaysMin);
  return {
    handlingDaysMin: hMin,
    handlingDaysMax: Math.max(hMin, days(r.handlingDaysMax, DEFAULT_POLICIES.handlingDaysMax)),
    transitDaysMin: tMin,
    transitDaysMax: Math.max(tMin, days(r.transitDaysMax, DEFAULT_POLICIES.transitDaysMax)),
    shipRegion: typeof r.shipRegion === "string" ? r.shipRegion.trim().toUpperCase() : "",
    returnsAccepted: r.returnsAccepted !== false,
    returnDays: days(r.returnDays, DEFAULT_POLICIES.returnDays),
    customerPaysReturnShipping: r.customerPaysReturnShipping !== false,
  };
}

/** Variables para los textos legales: {deliveryDaysMin}, {deliveryDaysMax}, {returnDays}. */
export function policyVars(p: Policies): Record<string, string> {
  return {
    deliveryDaysMin: String(Math.max(1, p.handlingDaysMin + p.transitDaysMin)),
    deliveryDaysMax: String(Math.max(1, p.handlingDaysMax + p.transitDaysMax)),
    returnDays: String(p.returnDays),
  };
}
