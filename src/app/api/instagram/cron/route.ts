import { NextResponse, type NextRequest } from "next/server";
import { serviceClient, serviceConfigured } from "@/lib/db/service";
import { syncTenant } from "@/lib/instagram/sync";
import { tenantSlug } from "@/lib/tenant";

/**
 * Revisión automática. La llama un cron con `Authorization: Bearer <CRON_SECRET>`
 * (Vercel Cron la manda sola). `?full=1` = escaneo completo (detecta posts borrados).
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ ok: false }, { status: 401 });
  if (!serviceConfigured()) return NextResponse.json({ ok: false, message: "Falta SUPABASE_SECRET_KEY." }, { status: 503 });
  const r = await syncTenant(serviceClient(), tenantSlug(), { full: req.nextUrl.searchParams.get("full") === "1" });
  // "not-connected" no es un error del cron: la marca todavía no conectó su cuenta.
  return NextResponse.json(r, { status: r.ok || r.reason === "not-connected" ? 200 : 502 });
}
