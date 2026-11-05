import { NextResponse } from "next/server";
import { currentMember } from "@/lib/instagram/auth";
import { serviceClient, serviceConfigured } from "@/lib/db/service";
import { telegram } from "@/lib/alerts/channels";
import { readConfig, writeConfig } from "@/lib/alerts/server";

type Update = { update_id: number; message?: { text?: string; chat: { id: number; type: string; title?: string; first_name?: string; last_name?: string } } };

/**
 * Revisa si alguien tocó «Iniciar» con un código de vinculación (de cualquier marca) y guarda ese chat
 * como destinatario. Usa getUpdates (sin webhook): el bot no necesita otra configuración.
 */
export async function POST() {
  const me = await currentMember();
  if (!me) return NextResponse.json({ ok: false, message: "Sin acceso." }, { status: 403 });
  if (!serviceConfigured()) return NextResponse.json({ ok: false, message: "Falta SUPABASE_SECRET_KEY en el servidor." }, { status: 503 });
  const { json } = await telegram("getUpdates", { allowed_updates: ["message"], timeout: 0 });
  if (!json.ok) return NextResponse.json({ ok: false, message: `Telegram: ${String(json.description ?? "sin respuesta")}` }, { status: 502 });
  const updates = (json.result ?? []) as Update[];
  const db = serviceClient();
  const linked: { tenantId: string; label: string }[] = [];

  for (const u of updates) {
    const m = u.message;
    const code = m?.text?.match(/^\/start(?:@\w+)?\s+([A-Za-z0-9]+)/)?.[1];
    if (!m || !code) continue;
    const { data: row } = await db.from("telegram_link_codes").select("tenant_id").eq("code", code).maybeSingle();
    if (!row) continue;
    const tenantId = row.tenant_id as string;
    const chat = m.chat;
    const label = chat.title ? `Grupo «${chat.title}»` : [chat.first_name, chat.last_name].filter(Boolean).join(" ") || String(chat.id);
    const cfg = await readConfig(db, tenantId);
    const tg = cfg.channels.telegram;
    if (!tg.recipients.some((r) => r.to === String(chat.id))) tg.recipients.push({ to: String(chat.id), label });
    tg.on = true;
    await writeConfig(db, tenantId, cfg);
    await db.from("telegram_link_codes").delete().eq("code", code);
    const { data: t } = await db.from("tenants").select("name").eq("id", tenantId).maybeSingle();
    await telegram("sendMessage", { chat_id: chat.id, text: `Listo. Aquí llegarán los pedidos nuevos de ${(t?.name as string) ?? "la tienda"}.` });
    linked.push({ tenantId, label });
  }
  // Confirma lo leído para que Telegram no lo vuelva a mandar.
  const last = updates.at(-1)?.update_id;
  if (last != null) await telegram("getUpdates", { offset: last + 1, timeout: 0 });

  const mine = linked.filter((l) => l.tenantId === me.tenantId).map((l) => l.label);
  return NextResponse.json({ ok: true, linked: mine, config: await readConfig(db, me.tenantId) });
}
