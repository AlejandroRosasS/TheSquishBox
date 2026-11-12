import { formatPrice } from "@/lib/format";

export const money = (n: number) => formatPrice(n);
/** "S/ 1,240" (sin decimales, como en los KPIs del diseño). */
export const moneyShort = (n: number) => `S/ ${Math.round(n).toLocaleString("en-US")}`;

export const ORDER_STATUS: Record<string, [string, string]> = {
  nuevo: ["Nuevo", "nuevo"],
  prep: ["En preparación", "prep"],
  listo: ["Listo", "listo"],
  entregado: ["Entregado", "entregado"],
  cancelado: ["Cancelado", "cancelado"],
};

export const DELIVERY_STATUS: Record<string, [string, string]> = {
  ok: ["Sin diferencia", "pagado"],
  pend: ["Cobrar diferencia", "pend"],
  pagado: ["Dif. pagada", "pagado"],
  dev: ["Devolver diferencia", "devuelto"],
  devuelto: ["Devuelto", "devuelto"],
  pendconf: ["Por confirmar", "cancelado"],
  taller: ["Recojo", "cancelado"],
};

export const PARTY_STATUS: Record<string, [string, string]> = {
  nueva: ["Nuevo", "nuevo"],
  cotizada: ["Cotizado", "prep"],
  aceptada: ["Aceptado", "entregado"],
  descartada: ["Descartado", "cancelado"],
};

/** Mensajes del formulario de Contacto: no se cotizan, solo se responden. */
export const CONTACT_STATUS: Record<string, [string, string]> = {
  nueva: ["Nuevo", "nuevo"],
  cotizada: ["Respondido", "entregado"],
  aceptada: ["Respondido", "entregado"],
  descartada: ["Descartado", "cancelado"],
};

export const partyStatus = (r: { status: string; contact?: boolean }) => (r.contact ? CONTACT_STATUS : PARTY_STATUS)[r.status] ?? PARTY_STATUS.nueva;

export function todayLabel(iso: string) {
  const d = new Date(`${iso}T12:00:00`);
  const s = new Intl.DateTimeFormat("es-PE", { weekday: "long", day: "numeric", month: "short" }).format(d).replace(",", "").replace(".", "");
  return s.charAt(0).toUpperCase() + s.slice(1);
}
