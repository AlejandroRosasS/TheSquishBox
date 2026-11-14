import type { Line, Product, Variant } from "./types";
import { hasOptions } from "./catalog";

/**
 * Google Analytics 4 por marca. El ID de medición se pone en Admin › SEO › Avanzado;
 * vacío o mal escrito = la tienda no carga nada. El admin nunca lo carga.
 */

/** Devuelve el ID limpio («G-XXXXXXX») o null si no tiene la forma de un ID de GA4. */
export function analyticsIdOf(raw: string | undefined | null): string | null {
  const id = (raw ?? "").trim().toUpperCase();
  return /^G-[A-Z0-9]{4,20}$/.test(id) ? id : null;
}

type Gtag = (cmd: "event", name: string, params: Record<string, unknown>) => void;

/** Manda un evento a GA4. No hace nada si la tienda no tiene Analytics (ni en las vistas previas del admin). */
export function track(name: string, params: Record<string, unknown>): void {
  if (typeof window === "undefined") return;
  if (window.location.pathname.startsWith("/admin")) return;
  const gtag = (window as unknown as { gtag?: Gtag }).gtag;
  if (typeof gtag !== "function") return;
  try {
    gtag("event", name, params);
  } catch {}
}

/** Producto en el formato `items` de los eventos de e-commerce de GA4. */
export function gaItem(p: Product, v: Variant, qty: number, lines: Line[], index?: number) {
  return {
    item_id: p.id,
    item_name: p.name,
    item_category: lines.find((l) => l.id === p.line)?.name ?? (p.line || undefined),
    item_variant: hasOptions(p) ? v.label : undefined,
    price: v.price,
    quantity: qty,
    ...(v.campaign ? { promotion_name: v.campaign.name } : {}),
    ...(index != null ? { index } : {}),
  };
}

/** Suma redondeada a céntimos (GA4 no necesita más precisión). */
export const gaValue = (n: number) => Math.round(n * 100) / 100;
