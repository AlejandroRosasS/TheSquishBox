/**
 * Reseñas de productos (ver supabase/migrations/0017_reviews.sql).
 * Solo reseñan clientes reales con un link único; el equipo aprueba cada reseña antes de publicarla.
 * Este archivo lo usan la tienda, el admin y el servidor: no importa nada del servidor.
 */

/** Reseña aprobada, como la ve la tienda. `productId` es el id público del producto (su slug). */
export type Review = {
  id: string;
  productId: string;
  rating: number;
  body: string;
  author: string;
  verified: boolean;
  reply: string;
  createdAt: string;
};

export type ReviewStatus = "pending" | "approved" | "hidden";

/** Columnas que el público puede leer (las demás solo las ve el equipo). */
export const PUBLIC_REVIEW_COLUMNS = "id, product_id, rating, body, author_name, verified, reply, created_at";

export type PublicReviewRow = {
  id: string;
  product_id: string;
  rating: number;
  body: string | null;
  author_name: string;
  verified: boolean;
  reply: string | null;
  created_at: string;
};

/** Promedio redondeado a un decimal: 4.75 → 4.8. */
export const roundRating = (n: number) => Math.round(n * 10) / 10;

/** "4.8" o "5" (sin ".0"). */
export const ratingText = (n: number) => roundRating(n).toLocaleString("es-PE", { maximumFractionDigits: 1, minimumFractionDigits: 0 });

/** "1 reseña" / "12 reseñas". */
export const countText = (n: number) => `${n} ${n === 1 ? "reseña" : "reseñas"}`;

/** Reemplaza {nombre}, {marca} y {link} en los mensajes que se le mandan al cliente. */
export function fillTemplate(text: string, vars: { nombre?: string; marca?: string; link?: string }): string {
  return text
    .replace(/\{nombre\}/g, vars.nombre ?? "")
    .replace(/\{marca\}/g, vars.marca ?? "")
    .replace(/\{link\}/g, vars.link ?? "")
    .replace(/\s+([,.!?])/g, "$1")
    .replace(/ {2,}/g, " ")
    .trim();
}

/** Nombre sugerido para mostrar: "Ana Rojas Pérez" → "Ana R." */
export function shortName(full: string): string {
  const parts = full.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "";
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[1][0].toUpperCase()}.`;
}

/** Ruta pública del link de reseña. */
export const reviewPath = (token: string) => `/resena/${token}`;

/** Fecha corta para la tienda: "13 nov 2026". */
export function reviewDate(iso: string): string {
  return new Intl.DateTimeFormat("es-PE", { timeZone: "America/Lima", day: "numeric", month: "short", year: "numeric" }).format(new Date(iso)).replace(/\./g, "");
}
