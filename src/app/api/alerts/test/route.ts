import { NextResponse, type NextRequest } from "next/server";
import { currentMember } from "@/lib/instagram/auth";
import { CHANNELS, type ChannelKey } from "@/lib/alerts/config";
import { sendAlert } from "@/lib/alerts/channels";
import { testMessage } from "@/lib/alerts/message";
import { siteOrigin } from "@/lib/alerts/origin";
import { serverClient } from "@/lib/db/server";
import { readConfig } from "@/lib/alerts/server";

/** «Enviar prueba»: manda un mensaje a los destinatarios guardados de un canal y responde cómo le fue a cada uno. */
export async function POST(req: NextRequest) {
  const me = await currentMember();
  if (!me) return NextResponse.json({ ok: false, message: "Sin acceso." }, { status: 403 });
  const { channel } = (await req.json().catch(() => ({}))) as { channel?: ChannelKey };
  if (!channel || !CHANNELS.includes(channel)) return NextResponse.json({ ok: false, message: "Canal inválido." }, { status: 400 });
  const db = await serverClient();
  const cfg = await readConfig(db, me.tenantId);
  const { data: t } = await db.from("tenants").select("name").eq("id", me.tenantId).maybeSingle();
  const brand = (t?.name as string) ?? "";
  const list = cfg.channels[channel].recipients;
  if (!list.length) return NextResponse.json({ ok: false, message: "Agrega al menos un destinatario." }, { status: 400 });
  const msg = testMessage(brand, siteOrigin(req));
  const results = await Promise.all(list.map(async (r) => ({ label: r.label, ...(await sendAlert(channel, r.to, msg, brand)) })));
  return NextResponse.json({ ok: results.every((r) => r.ok), results });
}
