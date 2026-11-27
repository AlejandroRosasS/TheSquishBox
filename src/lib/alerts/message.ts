import { formatPrice } from "@/lib/format";
import { dayLabel, isContactParty, orderCode, partyCode, type OrderRow } from "@/lib/db/orders";

export type AlertMessage = {
  /** Primera línea, también asunto del correo. */
  title: string;
  /** Detalle en varias líneas (Telegram y correo). */
  lines: string[];
  /** Resumen en una sola línea (las variables de las plantillas de WhatsApp no aceptan saltos de línea). */
  oneLine: string;
  /** Link al pedido en el panel. */
  url: string;
};

const str = (v: unknown) => (typeof v === "string" ? v.trim() : v == null ? "" : String(v));
const PAY: Record<string, string> = { yape: "Yape", plin: "Plin", tarjeta: "tarjeta" };

/** Títulos de los avisos de cambios (el evento dice a qué estado pasó, aunque luego haya cambiado otra vez). */
const CHANGE_TITLE: Record<string, string> = {
  order_paid: "Pago confirmado",
  order_preparing: "En preparación",
  order_ready: "Listo",
  order_awaiting_courier: "Esperando delivery",
  order_in_transit: "En tránsito",
  order_delivered: "Entregado",
  order_cancelled: "Cancelado",
};

/** Aviso de un cambio en un pedido de la tienda: pago confirmado o nuevo estado. Más corto que el de pedido nuevo. */
function changeMessage(o: OrderRow, origin: string, event: string): AlertMessage {
  const c = (o.customer ?? {}) as Record<string, unknown>;
  const d = (o.delivery ?? {}) as Record<string, unknown>;
  const code = orderCode(o.number);
  const total = formatPrice(Number(o.total));
  const what = CHANGE_TITLE[event] ?? event;
  const who = [str(c.name), str(c.phone)].filter(Boolean).join(" · ");
  const where = d.mode === "pickup" ? "Recojo" : [str(d.district), str(d.address)].filter(Boolean).join(" · ");
  const method = PAY[o.payment_method ?? ""] ?? o.payment_method ?? "";
  const pay = event === "order_paid" ? `${total} con ${method}` : o.payment_status === "paid" ? `Pagado · ${total}` : `Pago por confirmar · ${total}`;
  return {
    title: event === "order_paid" ? `Pago confirmado · pedido #${code}` : `Pedido #${code} · ${what}`,
    lines: [who, where, pay].filter(Boolean),
    oneLine: [`#${code}`, what, str(c.name), total].filter(Boolean).join(" · "),
    url: `${origin}/admin/pedidos/${code}`,
  };
}

/**
 * Arma el aviso de un pedido con lo que se guardó en la base. Sin textos de marca: el nombre viene de la base.
 * `event`: order_new / party_new (pedido o mensaje nuevo) o un cambio (order_paid, order_preparing, …).
 */
export function orderMessage(o: OrderRow, origin: string, event = "order_new"): AlertMessage {
  if (event in CHANGE_TITLE && o.kind === "store") return changeMessage(o, origin, event);
  const c = (o.customer ?? {}) as Record<string, unknown>;
  const d = (o.delivery ?? {}) as Record<string, unknown>;
  const who = [str(c.name), str(c.phone)].filter(Boolean).join(" · ");
  const date = dayLabel(d.date);

  if (o.kind === "party") {
    const p = (o.party ?? {}) as Record<string, unknown>;
    const code = partyCode(o.number, p);
    if (isContactParty(p)) {
      const reason = str(p.reason);
      return {
        title: `Nuevo mensaje de contacto ${code}`,
        lines: [who, reason ? `Motivo: ${reason}` : "", str(c.email), str(p.idea)].filter(Boolean),
        oneLine: [code, str(c.name), reason, str(p.idea).replace(/\s+/g, " ").slice(0, 120)].filter(Boolean).join(" · "),
        url: `${origin}/admin/pedidos/${code}`,
      };
    }
    const what = [str(p.qty), str(p.box), str(p.size)].filter(Boolean).join(" · ");
    const where = [str(d.district), date].filter(Boolean).join(" · ");
    const lines = [who, where, what, str(p.extras), str(p.idea)].filter(Boolean);
    return {
      title: `Nuevo pedido especial ${code}`,
      lines,
      oneLine: [code, str(c.name), where, what].filter(Boolean).join(" · "),
      url: `${origin}/admin/pedidos/${code}`,
    };
  }

  const code = orderCode(o.number);
  const pickup = d.mode === "pickup";
  const where = pickup ? `Recojo${date ? ` · ${date}` : ""}` : [`Delivery a ${str(d.district)}`, date].filter(Boolean).join(" · ");
  const items = (o.items ?? []).map((it) => `• ${it.qty ?? 1} × ${str(it.name)}${it.variant ? ` (${str(it.variant)})` : ""}`);
  const pay = o.payment_status === "paid" ? `Pagado con ${PAY[o.payment_method ?? ""] ?? o.payment_method}` : `Pago por confirmar · ${PAY[o.payment_method ?? ""] ?? o.payment_method ?? ""}`;
  const total = formatPrice(Number(o.total));
  const lines = [who, where, ...items, o.gift_message ? `Mensaje de regalo: ${o.gift_message}` : "", pay].filter(Boolean);
  const units = (o.items ?? []).reduce((n, it) => n + Number(it.qty ?? 1), 0);
  return {
    title: `Nuevo pedido #${code} · ${total}`,
    lines,
    oneLine: [`#${code}`, total, str(c.name), where, `${units} ${units === 1 ? "producto" : "productos"}`].filter(Boolean).join(" · "),
    url: `${origin}/admin/pedidos/${code}`,
  };
}

/** Mensaje de prueba desde Admin › Notificaciones. */
export function testMessage(brand: string, origin: string): AlertMessage {
  return {
    title: `Prueba de alertas · ${brand}`,
    lines: ["Si ves este mensaje, aquí llegarán los pedidos nuevos de la tienda."],
    oneLine: "Mensaje de prueba: aquí llegarán los pedidos nuevos",
    url: `${origin}/admin/pedidos`,
  };
}

export type ReviewAlertRow = { rating: number; body: string | null; author_name: string; products: { name: string } | null };

/** Aviso de reseña nueva (una por link: puede traer varios productos). */
export function reviewMessage(reviews: ReviewAlertRow[], origin: string): AlertMessage {
  const stars = (n: number) => "★".repeat(n) + "☆".repeat(5 - n);
  const who = reviews[0]?.author_name ?? "";
  const lines = reviews.flatMap((r) => [`${stars(r.rating)} ${r.products?.name ?? ""}`.trim(), r.body ? `“${str(r.body).replace(/\s+/g, " ").slice(0, 300)}”` : ""]).filter(Boolean);
  const first = reviews[0];
  return {
    title: `Nueva reseña de ${who}${reviews.length > 1 ? ` (${reviews.length} productos)` : ""}`,
    lines: [...lines, "Revísala y publícala en el panel."],
    oneLine: [who, ...reviews.map((r) => `${r.rating}/5 ${r.products?.name ?? ""}`.trim()), first?.body ? str(first.body).replace(/\s+/g, " ").slice(0, 120) : ""].filter(Boolean).join(" · "),
    url: `${origin}/admin/resenas`,
  };
}
