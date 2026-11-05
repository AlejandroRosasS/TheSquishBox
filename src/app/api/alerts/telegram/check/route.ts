import { NextResponse } from "next/server";
import { currentMember } from "@/lib/instagram/auth";
import { serviceClient, serviceConfigured } from "@/lib/db/service";
import { telegram } from "@/lib/alerts/channels";
import { readConfig } from "@/lib/alerts/server";
import { linkChat, type TgChat } from "@/lib/telegram/bot";

type Update = { update_id: number; message?: { text?: string; chat: TgChat } };

/**
 * Revisa si alguien tocó «Iniciar» con un código de vinculación (de cualquier marca) y guarda ese chat
 * como destinatario. Sin webhook usa getUpdates; con webhook (producción) el bot ya vinculó el chat
 * y dejó su nombre en telegram_link_codes.linked_label.
 */
export async function POST() {
  const me = await currentMember();
  if (!me) return NextResponse.json({ ok: false, message: "Sin acceso." }, { status: 403 });
  if (!serviceConfigured()) return NextResponse.json({ ok: false, message: "Falta SUPABASE_SECRET_KEY en el servidor." }, { status: 503 });
  const db = serviceClient();
  const { status, json } = await telegram("getUpdates", { allowed_updates: ["message"], timeout: 0 });
  if (status === 409) {
    const { data } = await db.from("telegram_link_codes").select("code, linked_label").eq("tenant_id", me.tenantId).not("linked_label", "is", null);
    const rows = (data ?? []) as { code: string; linked_label: string }[];
    if (rows.length) await db.from("telegram_link_codes").delete().in("code", rows.map((r) => r.code));
    return NextResponse.json({ ok: true, linked: rows.map((r) => r.linked_label), config: await readConfig(db, me.tenantId) });
  }
  if (!json.ok) return NextResponse.json({ ok: false, message: `Telegram: ${String(json.description ?? "sin respuesta")}` }, { status: 502 });
  const updates = (json.result ?? []) as Update[];
  const linked: { tenantId: string; label: string }[] = [];

  for (const u of updates) {
    const m = u.message;
    const code = m?.text?.match(/^\/start(?:@\w+)?\s+([A-Za-z0-9]+)/)?.[1];
    if (!m || !code) continue;
    const l = await linkChat(db, code, m.chat, { keepCode: false });
    if (l) linked.push(l);
  }
  // Confirma lo leído para que Telegram no lo vuelva a mandar.
  const last = updates.at(-1)?.update_id;
  if (last != null) await telegram("getUpdates", { offset: last + 1, timeout: 0 });

  const mine = linked.filter((l) => l.tenantId === me.tenantId).map((l) => l.label);
  return NextResponse.json({ ok: true, linked: mine, config: await readConfig(db, me.tenantId) });
}
