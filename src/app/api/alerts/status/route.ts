import { NextResponse } from "next/server";
import { currentMember } from "@/lib/instagram/auth";
import { serviceConfigured } from "@/lib/db/service";
import { channelReady } from "@/lib/alerts/channels";
import { telegramBotName } from "@/lib/alerts/server";

/** Qué canales tienen cuenta configurada en el servidor (Admin › Notificaciones). */
export async function GET() {
  const me = await currentMember();
  if (!me) return NextResponse.json({ ok: false }, { status: 403 });
  return NextResponse.json({
    ok: true,
    server: serviceConfigured(),
    ready: { telegram: channelReady("telegram"), email: channelReady("email"), whatsapp: channelReady("whatsapp") },
    bot: await telegramBotName(),
    whatsappTemplate: Boolean(process.env.WHATSAPP_TEMPLATE?.trim()),
  });
}
