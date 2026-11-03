import type { Product } from "@/lib/types";
import type { DemoOrder, LogEntry, Note, OrderStatus, PartyRequest, PartyStatus } from "@/lib/admin/types";
import { publicClient } from "./public";

/** Número de pedido visible: 42 → "0042". Las fiestas llevan prefijo: "F-0042". */
export const orderCode = (n: number) => String(n).padStart(4, "0");
export const partyCode = (n: number) => `F-${orderCode(n)}`;

// ─────────── Tienda: crear pedidos (sin sesión, vía RPC) ───────────

export type PlaceOrderInput = {
  items: { variant_id: string; qty: number }[];
  customer: { name: string; phone: string; email: string; doc: { type: "boleta"; dni: string } | { type: "factura"; ruc: string; razon: string } };
  delivery:
    | { mode: "delivery"; address: string; district: string; reference: string; date: string; recipient: string }
    | { mode: "pickup"; date: string };
  payment_method: string;
  gift_message: string;
};

/** Crea el pedido en la base. El precio, el stock y el delivery los calcula la base, no el navegador. */
export async function placeOrder(slug: string, input: PlaceOrderInput) {
  const { data, error } = await publicClient().rpc("place_order", { tenant_slug: slug, p: input });
  if (error) throw new Error(error.message);
  const row = (Array.isArray(data) ? data[0] : data) as { order_id: string; order_number: number; order_total: number };
  return { id: row.order_id, number: row.order_number, total: Number(row.order_total) };
}

export type PlacePartyInput = {
  customer: { name: string; phone: string; email: string };
  delivery: { district: string; date: string };
  party: { box: string; qty: string; size: string; extras: string; idea: string; refs: string[] };
};

export async function placePartyRequest(slug: string, input: PlacePartyInput): Promise<number> {
  const { data, error } = await publicClient().rpc("place_party_request", { tenant_slug: slug, p: input });
  if (error) throw new Error(error.message);
  return Number(data);
}

// ─────────── Admin: filas de la base → vistas del admin ───────────

export type OrderRow = {
  id: string;
  number: number;
  kind: "store" | "party";
  status: string;
  payment_method: string | null;
  payment_status: string;
  customer: Record<string, unknown>;
  delivery: Record<string, unknown>;
  items: { variant_id?: string; product?: string; name?: string; variant?: string; price?: number; qty?: number }[];
  party: Record<string, unknown> | null;
  proposal: string | null;
  subtotal: number;
  delivery_fee: number | null;
  delivery_cost: number | null;
  total: number;
  gift_message: string | null;
  created_at: string;
};

export type EventRow = { id: number; order_id: string; kind: string; text: string; created_at: string };

export const ORDER_COLUMNS =
  "id, number, kind, status, payment_method, payment_status, customer, delivery, items, party, proposal, subtotal, delivery_fee, delivery_cost, total, gift_message, created_at";

const TZ = "America/Lima";
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const fmt = (opts: Intl.DateTimeFormatOptions, d: Date) => new Intl.DateTimeFormat("es-PE", opts).format(d).replace(/\./g, "");

/** "Sábado 31 oct, 10:42 a. m." */
export function whenLong(iso: string) {
  const d = new Date(iso);
  const day = fmt({ timeZone: TZ, weekday: "long", day: "numeric", month: "short" }, d).replace(",", "");
  const time = new Intl.DateTimeFormat("es-PE", { timeZone: TZ, hour: "numeric", minute: "2-digit" }).format(d);
  return `${cap(day)}, ${time}`;
}

/** "Sáb 31 oct, 10:42" */
export function whenShort(iso: string) {
  const d = new Date(iso);
  const day = fmt({ timeZone: TZ, weekday: "short", day: "numeric", month: "short" }, d).replace(",", "");
  const time = fmt({ timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false }, d);
  return `${cap(day)}, ${time}`;
}

/** Fecha elegida por el cliente (AAAA-MM-DD) → "Mar 3 nov". */
export function dayLabel(ymd: unknown) {
  if (typeof ymd !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return typeof ymd === "string" ? ymd : "";
  return cap(fmt({ timeZone: "UTC", weekday: "short", day: "numeric", month: "short" }, new Date(`${ymd}T12:00:00Z`)).replace(",", ""));
}

const str = (v: unknown) => (typeof v === "string" ? v : v == null ? "" : String(v));
const num = (v: unknown) => (v == null || v === "" ? null : Number(v));

export const STATUS_FROM_DB: Record<string, OrderStatus> = {
  new: "nuevo", quoted: "nuevo", accepted: "nuevo", preparing: "prep", ready: "listo", delivered: "entregado", cancelled: "cancelado",
};
export const STATUS_TO_DB: Record<OrderStatus, string> = {
  nuevo: "new", prep: "preparing", listo: "ready", entregado: "delivered", cancelado: "cancelled",
};
export const PARTY_FROM_DB: Record<string, PartyStatus> = {
  new: "nueva", quoted: "cotizada", accepted: "aceptada", cancelled: "descartada", preparing: "aceptada", ready: "aceptada", delivered: "aceptada",
};
export const PARTY_TO_DB: Record<PartyStatus, string> = { nueva: "new", cotizada: "quoted", aceptada: "accepted", descartada: "cancelled" };

const PAY_NAMES: Record<string, string> = { yape: "Yape", plin: "Plin", tarjeta: "tarjeta" };

function paymentLabel(r: OrderRow) {
  const m = PAY_NAMES[r.payment_method ?? ""] ?? r.payment_method ?? "";
  if (r.payment_status === "paid") return `Pagado con ${m}`;
  if (r.payment_status === "refunded") return "Devuelto";
  if (r.payment_status === "failed") return `Pago fallido · ${m}`;
  return `Pago por confirmar · ${m}`;
}

function docLabel(doc: unknown) {
  const d = (doc ?? {}) as Record<string, string>;
  const mask = (s: string) => (s.length > 3 ? `${s[0]}${"•".repeat(s.length - 3)}${s.slice(-2)}` : s);
  if (d.type === "factura") return `Factura · RUC ${d.ruc ?? ""}${d.razon ? ` · ${d.razon}` : ""}`;
  if (d.type === "boleta") return `Boleta · DNI ${mask(str(d.dni))}`;
  return "—";
}

function eventsOf(events: EventRow[], orderId: string) {
  const mine = events.filter((e) => e.order_id === orderId).sort((a, b) => b.created_at.localeCompare(a.created_at));
  const notes: Note[] = mine.filter((e) => e.kind === "note").map((e) => ({ who: "Equipo", when: whenShort(e.created_at), text: e.text }));
  const log: LogEntry[] = mine.filter((e) => e.kind !== "note").map((e) => ({ t: e.text, when: whenShort(e.created_at) }));
  return { notes, log };
}

export type DbOrder = DemoOrder & { link: string; refund: string; dbId: string; paymentStatus: string };

/** Pedido de la base → forma que usan las pantallas del admin. Los ítems guardan nombre y precio del momento de compra. */
export function toAdminOrder(r: OrderRow, events: EventRow[], catalog: { products: Product[] }): DbOrder {
  const c = r.customer as Record<string, unknown>;
  const d = r.delivery as Record<string, unknown>;
  const pickup = d.mode === "pickup";
  const fee = pickup ? 0 : Number(r.delivery_fee ?? 0);
  return {
    id: orderCode(r.number),
    dbId: r.id,
    client: str(c.name),
    phone: str(c.phone),
    email: str(c.email),
    createdAt: whenLong(r.created_at),
    payment: paymentLabel(r),
    paymentStatus: r.payment_status,
    lines: r.items.map((it) => {
      const p = catalog.products.find((x) => x.id === it.product);
      const v = p?.variants.find((x) => x.dbId === it.variant_id);
      return { productId: str(it.product), variantId: v?.id ?? "", qty: Number(it.qty ?? 1), price: Number(it.price ?? 0), name: str(it.name), variantLabel: str(it.variant) };
    }),
    district: pickup ? "Recojo" : str(d.district),
    address: pickup ? "" : str(d.address),
    reference: pickup ? "" : str(d.reference),
    date: dayLabel(d.date),
    doc: docLabel(c.doc),
    deliveryFee: fee,
    deliveryReal: num(r.delivery_cost),
    gift: str(r.gift_message),
    ...eventsOf(events, r.id),
    status: STATUS_FROM_DB[r.status] ?? "nuevo",
    delivery: "pendconf",
    link: str(d.diff_link) || "none",
    refund: str(d.refund) || "none",
  };
}

export type DbParty = PartyRequest & { dbId: string };

export function toAdminParty(r: OrderRow): DbParty {
  const c = r.customer as Record<string, unknown>;
  const d = r.delivery as Record<string, unknown>;
  const p = (r.party ?? {}) as Record<string, unknown>;
  const quote = (p.quote ?? {}) as Record<string, unknown>;
  const refs = Array.isArray(p.refs) ? (p.refs as string[]) : [];
  return {
    id: partyCode(r.number),
    dbId: r.id,
    name: str(c.name),
    when: whenShort(r.created_at),
    phone: str(c.phone),
    mail: str(c.email),
    qty: str(p.qty),
    theme: str(p.theme),
    box: str(p.box),
    size: str(p.size),
    extras: str(p.extras),
    date: dayLabel(d.date),
    district: str(d.district),
    idea: str(p.idea),
    img: refs[0] ?? "",
    refs,
    status: PARTY_FROM_DB[r.status] ?? "nueva",
    price: str(quote.price),
    deliveryFee: str(quote.deliveryFee),
    proposal: r.proposal ?? "",
  };
}
