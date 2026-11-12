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

/** Arma el aviso de un pedido nuevo con lo que se guardó en la base. Sin textos de marca: el nombre viene de la base. */
export function orderMessage(o: OrderRow, origin: string): AlertMessage {
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
