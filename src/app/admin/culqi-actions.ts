"use server";

import { serviceClient, serviceConfigured } from "@/lib/db/service";
import { currentMember } from "@/lib/instagram/auth";
import { orderCode } from "@/lib/db/orders";
import { chargeFees, chargeSucceeded, chargeTime, culqiAccount, getCharge, listCharges, cardLabel, type CulqiCharge } from "@/lib/culqi/server";

/** Origen de un cobro en la cuenta Culqi de la marca. */
export type CulqiOrigin = "web" | "web-sin-pedido" | "otro";

export type CulqiRow = {
  id: string;
  /** ISO, o "" si Culqi no mandó fecha. */
  date: string;
  origin: CulqiOrigin;
  order: string; // "0002" o ""
  orderId: string;
  /** Estado del pedido en el admin (pagado, fallido…), si hay pedido. */
  orderPayment: string;
  description: string;
  card: string;
  email: string;
  /** Montos en soles. fee/net en null = Culqi no los reportó en el cobro. */
  amount: number;
  refunded: number;
  fee: number | null;
  net: number | null;
};

export type CulqiStatement =
  | { ok: true; live: boolean; rows: CulqiRow[]; source: "culqi" | "pedidos"; truncated: boolean; missing: { order: string; orderId: string; ref: string; total: number }[] }
  | { ok: false; message: string };

const soles = (cents: number) => Math.round(cents) / 100;
const LIMA = 5 * 3600_000;

/**
 * Estado de cuenta de Culqi de un mes (hora de Lima), cruzado con los pedidos de la tienda.
 * Consulta a Culqi en el servidor con la llave secreta de la marca; solo para el equipo.
 */
export async function culqiStatement(month: string): Promise<CulqiStatement> {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return { ok: false, message: "Mes inválido." };
  const me = await currentMember();
  if (!me) return { ok: false, message: "Inicia sesión con una cuenta del equipo." };
  if (!serviceConfigured()) return { ok: false, message: "Falta configurar la base en el servidor." };
  const db = serviceClient();
  const acct = await culqiAccount(db, me.slug);
  if (!acct) return { ok: false, message: "Esta marca todavía no conectó su cuenta de Culqi (Ajustes › Pago con tarjeta)." };

  const [y, m] = month.split("-").map(Number);
  const fromMs = Date.UTC(y, m - 1, 1) + LIMA;
  const toMs = Date.UTC(y, m, 1) + LIMA - 1;

  // Pedidos con tarjeta del mes (con margen de un día por si el cobro cae en el borde).
  const { data: orders } = await db
    .from("orders")
    .select("id, number, total, payment_status, payment_ref, created_at")
    .eq("tenant_id", acct.tenantId)
    .eq("kind", "store")
    .eq("payment_method", "tarjeta")
    .gte("created_at", new Date(fromMs - 86400_000).toISOString())
    .lte("created_at", new Date(toMs + 86400_000).toISOString());
  const list = orders ?? [];
  const byId = new Map(list.map((o) => [o.id as string, o]));
  const byRef = new Map(list.filter((o) => o.payment_ref).map((o) => [o.payment_ref as string, o]));

  let charges: CulqiCharge[] = [];
  let source: "culqi" | "pedidos" = "culqi";
  let truncated = false;
  const listed = await listCharges(acct, fromMs, toMs);
  if (listed) {
    charges = listed.charges;
    truncated = listed.truncated;
  } else {
    // Si Culqi no deja listar, al menos se consultan los cobros que el admin conoce.
    source = "pedidos";
    const refs = list.map((o) => o.payment_ref).filter((r): r is string => !!r).slice(0, 100);
    charges = (await Promise.all(refs.map((r) => getCharge(acct, r)))).filter((c): c is CulqiCharge => !!c);
  }

  const rows: CulqiRow[] = charges.filter(chargeSucceeded).map((c) => {
    const o = byRef.get(c.id) ?? (c.metadata?.order_id ? byId.get(c.metadata.order_id) : undefined);
    const tagged = c.metadata?.canal === "web" || (c.metadata?.tenant === me.slug && !!c.metadata?.order_id);
    const origin: CulqiOrigin = o && o.payment_ref === c.id ? "web" : o || tagged ? "web-sin-pedido" : "otro";
    const { fee, net } = chargeFees(c);
    const t = chargeTime(c);
    return {
      id: c.id,
      date: t ? new Date(t).toISOString() : "",
      origin,
      order: o ? orderCode(o.number) : c.metadata?.order_number ? orderCode(Number(c.metadata.order_number)) : "",
      orderId: o?.id ?? "",
      orderPayment: o?.payment_status ?? "",
      description: c.description ?? "",
      card: cardLabel(c),
      email: c.email ?? "",
      amount: soles(c.amount),
      refunded: soles(c.amount_refunded ?? 0),
      fee: fee === null ? null : soles(fee),
      net: net === null ? null : soles(net),
    };
  });
  rows.sort((a, b) => b.date.localeCompare(a.date));

  // Pedidos marcados como pagados con tarjeta cuyo cobro no aparece en Culqi este mes.
  const seen = new Set(rows.map((r) => r.id));
  const inMonth = (iso: string) => { const t = Date.parse(iso); return t >= fromMs && t <= toMs; };
  const missing = source === "culqi" && !truncated
    ? list
        .filter((o) => o.payment_status === "paid" && o.payment_ref && !seen.has(o.payment_ref) && inMonth(o.created_at))
        .map((o) => ({ order: orderCode(o.number), orderId: o.id as string, ref: o.payment_ref as string, total: Number(o.total) }))
    : [];

  return { ok: true, live: acct.live, rows, source, truncated, missing };
}
