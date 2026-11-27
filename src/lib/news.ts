import type { NewsItem, Storefront } from "@/lib/types";

/** Zona horaria de las fechas de vencimiento (Perú, sin horario de verano). */
const LIMA_OFFSET = "-05:00";

/** Momento en que una novedad deja de verse: el fin del día `until` en Lima. null = no vence. */
export function newsEndsAt(item: Pick<NewsItem, "until">): number | null {
  if (!item.until || !/^\d{4}-\d{2}-\d{2}$/.test(item.until)) return null;
  const t = Date.parse(`${item.until}T23:59:59.999${LIMA_OFFSET}`);
  return Number.isNaN(t) ? null : t;
}

export const isNewsExpired = (item: Pick<NewsItem, "until">, now: number) => {
  const end = newsEndsAt(item);
  return end !== null && end < now;
};

/** Saca las novedades vencidas (o sin foto) del storefront que ve el cliente. */
export function withActiveNews(sf: Storefront, now: number): Storefront {
  if (!sf.news?.items?.length) return sf;
  return { ...sf, news: { ...sf.news, items: sf.news.items.filter((n) => n.image && !isNewsExpired(n, now)) } };
}

/** Próximo vencimiento (ISO) de una novedad vigente: a esa hora la tienda se vuelve a armar. */
export function nextNewsExpiry(sf: Storefront, now: number): string | null {
  const ends = (sf.news?.items ?? []).map(newsEndsAt).filter((t): t is number => t !== null && t >= now);
  return ends.length ? new Date(Math.min(...ends)).toISOString() : null;
}

/** Hoy en Lima (AAAA-MM-DD), para el mínimo del selector de fecha. */
export function todayLima(now = Date.now()): string {
  return new Date(now - 5 * 3600_000).toISOString().slice(0, 10);
}

export const newsId = () => `n${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/** Fecha corta para el admin: «vence el 5 dic». */
export function shortDate(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const months = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  return y && m && d ? `${d} ${months[m - 1]}` : ymd;
}
