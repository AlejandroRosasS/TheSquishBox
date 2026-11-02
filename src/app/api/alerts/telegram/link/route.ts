import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { currentMember } from "@/lib/instagram/auth";
import { serviceClient, serviceConfigured } from "@/lib/db/service";
import { telegramBotName } from "@/lib/alerts/server";

/** Crea un código para vincular un chat o grupo: el equipo abre el link, toca «Iniciar» y el bot queda conectado. */
export async function POST() {
  const me = await currentMember();
  if (!me) return NextResponse.json({ ok: false, message: "Sin acceso." }, { status: 403 });
  if (!serviceConfigured()) return NextResponse.json({ ok: false, message: "Falta SUPABASE_SECRET_KEY en el servidor." }, { status: 503 });
  const bot = await telegramBotName();
  if (!bot) return NextResponse.json({ ok: false, message: "El bot de Telegram no está configurado en el servidor." }, { status: 503 });
  const code = randomBytes(9).toString("base64url").replace(/[-_]/g, "x");
  const db = serviceClient();
  // Los códigos viejos (más de un día) ya no sirven.
  await db.from("telegram_link_codes").delete().lt("created_at", new Date(Date.now() - 86_400_000).toISOString());
  const { error } = await db.from("telegram_link_codes").insert({ code, tenant_id: me.tenantId });
  if (error) return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, code, bot, chatUrl: `https://t.me/${bot}?start=${code}`, groupUrl: `https://t.me/${bot}?startgroup=${code}` });
}
