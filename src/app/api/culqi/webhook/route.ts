import { NextResponse, type NextRequest } from "next/server";
import { serviceClient, serviceConfigured } from "@/lib/db/service";
import { tenantSlug } from "@/lib/tenant";
import { chargeSucceeded, culqiAccount, getCharge, markPaid } from "@/lib/culqi/server";

/**
 * Webhook de Culqi (CulqiPanel › Eventos › Webhook): <dominio de la tienda>/api/culqi/webhook
 *
 * Culqi no firma los eventos, así que no se confía en el contenido: solo se toma el id del
 * cobro y se vuelve a consultar a Culqi con la llave secreta de la marca. Si el cobro está pagado
 * y coincide con el pedido (monto e id), el pedido queda pagado. Sirve de respaldo si el cliente
 * cerró la página justo después de pagar.
 */
export async function POST(req: NextRequest) {
  if (!serviceConfigured()) return NextResponse.json({ ok: false }, { status: 503 });
  const evt = (await req.json().catch(() => null)) as { type?: string; data?: unknown } | null;
  if (!evt?.type) return NextResponse.json({ ok: false }, { status: 400 });

  let data: Record<string, unknown> = {};
  try {
    data = (typeof evt.data === "string" ? JSON.parse(evt.data) : evt.data ?? {}) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const db = serviceClient();
  const acct = await culqiAccount(db, tenantSlug());
  // 200 para que Culqi no reintente eventos que esta tienda no maneja.
  if (!acct) return NextResponse.json({ ok: true, ignored: "sin cuenta" });

  const chargeId = String(data.object === "charge" ? data.id ?? "" : data.charge_id ?? "");
  if (!chargeId.startsWith("chr_")) return NextResponse.json({ ok: true, ignored: evt.type });

  const charge = await getCharge(acct, chargeId);
  const orderId = charge?.metadata?.order_id;
  if (!charge || !orderId) return NextResponse.json({ ok: true, ignored: "cobro desconocido" });

  if ((charge.amount_refunded ?? 0) > 0) {
    const { data: upd } = await db
      .from("orders")
      .update({ payment_status: "refunded" })
      .eq("id", orderId)
      .eq("tenant_id", acct.tenantId)
      .eq("payment_ref", charge.id)
      .neq("payment_status", "refunded")
      .select("id");
    if (upd?.length) {
      await db.from("order_events").insert({ tenant_id: acct.tenantId, order_id: orderId, kind: "payment", text: "Devolución registrada en Culqi" });
    }
    return NextResponse.json({ ok: true });
  }

  if (chargeSucceeded(charge)) await markPaid(db, acct, orderId, charge);
  return NextResponse.json({ ok: true });
}
