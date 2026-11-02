import { NextResponse } from "next/server";
import { currentMember } from "@/lib/instagram/auth";
import { serviceClient, serviceConfigured } from "@/lib/db/service";
import { syncTenant } from "@/lib/instagram/sync";

/** Botón "Sincronizar ahora" del admin. */
export async function POST() {
  if (!serviceConfigured()) return NextResponse.json({ ok: false, message: "Instagram no está configurado en el servidor." }, { status: 503 });
  const me = await currentMember();
  if (!me) return NextResponse.json({ ok: false, message: "Sin acceso." }, { status: 403 });
  const db = serviceClient();
  const { data: acct } = await db.from("ig_accounts").select("last_sync_at").eq("tenant_id", me.tenantId).maybeSingle();
  // Evita repetir clics: una sincronización por minuto basta.
  if (acct?.last_sync_at && Date.now() - new Date(acct.last_sync_at).getTime() < 60_000) {
    return NextResponse.json({ ok: true, added: 0, updated: 0, removed: 0, recent: true });
  }
  const r = await syncTenant(db, me.slug);
  return NextResponse.json(r, { status: r.ok ? 200 : 502 });
}
