import { NextResponse, type NextRequest } from "next/server";
import { serviceClient, serviceConfigured } from "@/lib/db/service";
import { dispatchAlerts } from "@/lib/alerts/dispatch";
import { siteOrigin } from "@/lib/alerts/origin";

export const maxDuration = 60;

/**
 * POST: lo llama la tienda apenas se guarda un pedido, y el panel al recargar pedidos. No necesita sesión:
 * solo envía avisos que ya están en la cola (los crea la base al guardar el pedido), así que no se puede abusar
 * para mandar mensajes nuevos.
 */
export async function POST(req: NextRequest) {
  if (!serviceConfigured()) return NextResponse.json({ ok: false }, { status: 503 });
  try {
    const r = await dispatchAlerts(serviceClient(), siteOrigin(req), 8_000);
    return NextResponse.json({ ok: true, ...r });
  } catch (e) {
    return NextResponse.json({ ok: false, message: e instanceof Error ? e.message : "" }, { status: 500 });
  }
}

/** GET: cron (cada minuto desde Supabase, ver docs/ALERTAS.md). Pide `Authorization: Bearer <CRON_SECRET>`. */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ ok: false }, { status: 401 });
  if (!serviceConfigured()) return NextResponse.json({ ok: false, message: "Falta SUPABASE_SECRET_KEY." }, { status: 503 });
  try {
    const r = await dispatchAlerts(serviceClient(), siteOrigin(req), 45_000);
    return NextResponse.json({ ok: true, ...r });
  } catch (e) {
    return NextResponse.json({ ok: false, message: e instanceof Error ? e.message : "" }, { status: 500 });
  }
}
