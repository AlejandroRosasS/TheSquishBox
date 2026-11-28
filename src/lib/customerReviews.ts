import type { Policies } from "./policies";

/**
 * Google Customer Reviews por marca (ID de Merchant Center en Admin › SEO › Avanzado).
 * Es la encuesta de Google sobre la tienda (calificación del vendedor en Google Shopping): no reemplaza
 * las reseñas de producto de la tienda. Vacío = no se carga nada.
 */

/** ID de Merchant Center limpio (solo números) o null si no tiene esa forma. */
export function merchantIdOf(raw: string | undefined | null): number | null {
  const id = String(raw ?? "").replace(/\s+/g, "");
  return /^\d{6,15}$/.test(id) ? Number(id) : null;
}

export type BadgePosition = "BOTTOM_RIGHT" | "BOTTOM_LEFT";
export const BADGE_POSITIONS: { value: BadgePosition; label: string }[] = [
  { value: "BOTTOM_RIGHT", label: "Abajo a la derecha" },
  { value: "BOTTOM_LEFT", label: "Abajo a la izquierda" },
];

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Suma días hábiles (lunes a viernes) a una fecha. */
function addBusinessDays(from: Date, n: number): Date {
  const d = new Date(from.getFullYear(), from.getMonth(), from.getDate(), 12);
  let left = n;
  while (left > 0) {
    d.setDate(d.getDate() + 1);
    const wd = d.getDay();
    if (wd !== 0 && wd !== 6) left--;
  }
  return d;
}

/**
 * Fecha estimada de entrega para Google (AAAA-MM-DD). La fecha que eligió el cliente es tentativa
 * (se confirma por WhatsApp), así que se usa la más tardía entre esa fecha y el plazo máximo de
 * Entregas (preparación + traslado, en días hábiles) contado desde el día del pedido.
 * Google manda la encuesta después de esta fecha: mejor tarde que antes de que llegue el pedido.
 */
export function estimatedDeliveryDate(createdAt: string, preferred: string, p: Policies): string {
  const created = new Date(createdAt);
  const base = Number.isNaN(created.getTime()) ? new Date() : created;
  const byPolicy = iso(addBusinessDays(base, Math.max(1, p.handlingDaysMax + p.transitDaysMax)));
  return /^\d{4}-\d{2}-\d{2}$/.test(preferred) && preferred > byPolicy ? preferred : byPolicy;
}

/** Idioma de las ventanas de Google: español latinoamericano para es-PE y parecidos. */
export const googleLang = (locale: string) => (locale.toLowerCase().startsWith("es") ? "es-419" : locale);
