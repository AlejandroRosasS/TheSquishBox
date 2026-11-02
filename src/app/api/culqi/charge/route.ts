import { NextResponse, type NextRequest } from "next/server";
import { serviceClient, serviceConfigured } from "@/lib/db/service";
import { tenantSlug } from "@/lib/tenant";
import { createCharge, culqiAccount, markPaid, toCents } from "@/lib/culqi/server";
import { orderCode } from "@/lib/db/orders";

/**
 * Cobra un pedido de la tienda con el token de tarjeta que devolvió Culqi Checkout.
 * El monto sale del pedido en la base, nunca del navegador.
 * body: { orderId, token, authentication3DS? }
 */
export async function POST(req: NextRequest) {
  const fail = (message: string, status = 400, extra: Record<string, unknown> = {}) =>
    NextResponse.json({ ok: false, message, ...extra }, { status });

  if (!serviceConfigured()) return fail("El pago con tarjeta no está disponible en este momento.", 503);
  const body = (await req.json().catch(() => null)) as { orderId?: string; token?: string; deviceId?: string | null; authentication3DS?: Record<string, unknown> } | null;
  const orderId = body?.orderId ?? "";
  const token = body?.token ?? "";
  if (!/^[0-9a-f-]{36}$/i.test(orderId) || !/^tkn_(test|live)_[A-Za-z0-9]+$/.test(token)) return fail("Datos de pago incompletos.");

  const db = serviceClient();
  const slug = tenantSlug();
  const acct = await culqiAccount(db, slug);
  if (!acct?.enabled) return fail("El pago con tarjeta no está activo en esta tienda.", 409);

  const { data: o } = await db
    .from("orders")
    .select("id, number, kind, status, payment_method, payment_status, customer, delivery, total")
    .eq("id", orderId)
    .eq("tenant_id", acct.tenantId)
    .maybeSingle();
  if (!o || o.kind !== "store") return fail("No encontramos tu pedido.", 404);
  if (o.payment_status === "paid") return NextResponse.json({ ok: true, number: o.number });
  if (o.status === "cancelled" || o.payment_method !== "tarjeta") return fail("Este pedido ya no se puede pagar con tarjeta.", 409);

  const c = (o.customer ?? {}) as Record<string, string>;
  const d = (o.delivery ?? {}) as Record<string, string>;
  const result = await createCharge(acct, {
    token,
    amountCents: toCents(o.total),
    email: c.email ?? "",
    description: `Pedido ${orderCode(o.number)}`,
    metadata: { tenant: slug, order_id: o.id, order_number: String(o.number) },
    customer: { name: c.name ?? "", phone: c.phone ?? "", address: [d.address, d.district].filter(Boolean).join(", ") },
    deviceId: typeof body?.deviceId === "string" && /^[0-9a-f-]{8,64}$/i.test(body.deviceId) ? body.deviceId : null,
    authentication3DS: body?.authentication3DS && typeof body.authentication3DS === "object" ? body.authentication3DS : undefined,
  });

  if (result.kind === "review") return NextResponse.json({ ok: false, review: true, amount: toCents(o.total), email: c.email ?? "" });

  if (result.kind === "declined") {
    await db.from("orders").update({ payment_status: "failed" }).eq("id", o.id).neq("payment_status", "paid");
    await db.from("order_events").insert({
      tenant_id: acct.tenantId, order_id: o.id, kind: "payment",
      text: `Pago con tarjeta rechazado (${result.code}). El cliente puede reintentar.`,
    });
    return fail(result.message, 402, { code: result.code });
  }

  const ok = await markPaid(db, acct, o.id, result.charge);
  if (!ok) return fail("Recibimos tu pago pero no pudimos confirmar el pedido. Escríbenos por WhatsApp con tu número de pedido.", 500);
  return NextResponse.json({ ok: true, number: o.number });
}
