import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { telegram } from "@/lib/alerts/channels";
import { readConfig, writeConfig } from "@/lib/alerts/server";

export type TgChat = { id: number; type: string; title?: string; first_name?: string; last_name?: string };

/** Clave que Telegram manda en cada llamada al webhook. Sale del token: no hay otra variable que configurar. */
export function webhookSecret(): string {
  return createHash("sha256").update(`webhook:${process.env.TELEGRAM_BOT_TOKEN ?? ""}`).digest("hex").slice(0, 48);
}

export const chatLabel = (chat: TgChat) =>
  chat.title ? `Grupo «${chat.title}»` : [chat.first_name, chat.last_name].filter(Boolean).join(" ") || String(chat.id);

/**
 * /start <código>: guarda el chat como destinatario de las alertas de la marca del código.
 * Devuelve la marca vinculada o null si el código no existe.
 */
export async function linkChat(db: SupabaseClient, code: string, chat: TgChat, opts: { keepCode: boolean }) {
  const { data: row } = await db.from("telegram_link_codes").select("tenant_id").eq("code", code).maybeSingle();
  if (!row) return null;
  const tenantId = row.tenant_id as string;
  const label = chatLabel(chat);
  const cfg = await readConfig(db, tenantId);
  const tg = cfg.channels.telegram;
  if (!tg.recipients.some((r) => r.to === String(chat.id))) tg.recipients.push({ to: String(chat.id), label });
  tg.on = true;
  await writeConfig(db, tenantId, cfg);
  // Con webhook, la pantalla de Notificaciones se entera por esta marca (y luego borra el código).
  if (opts.keepCode) await db.from("telegram_link_codes").update({ linked_label: label }).eq("code", code);
  else await db.from("telegram_link_codes").delete().eq("code", code);
  const { data: t } = await db.from("tenants").select("name").eq("id", tenantId).maybeSingle();
  const brand = (t?.name as string) ?? "la tienda";
  await telegram("sendMessage", {
    chat_id: chat.id,
    text: `Listo. Aquí llegarán los pedidos nuevos de ${brand}.\n\nTambién puedes mandarme ventas manuales en CSV (archivo o texto). Escribe /ayuda para ver cómo.`,
  });
  return { tenantId, label, brand };
}

/** Marcas cuyo canal de Telegram incluye este chat. */
export async function tenantsOfChat(db: SupabaseClient, chatId: number): Promise<{ id: string; slug: string; name: string }[]> {
  const { data } = await db.from("site_docs").select("tenant_id, body").eq("kind", "notifications").eq("stage", "published");
  const ids = (data ?? [])
    .filter((r) => ((r.body as { channels?: { telegram?: { recipients?: { to: string }[] } } })?.channels?.telegram?.recipients ?? []).some((x) => x.to === String(chatId)))
    .map((r) => r.tenant_id as string);
  if (!ids.length) return [];
  const { data: ts } = await db.from("tenants").select("id, slug, name").in("id", ids);
  return (ts ?? []) as { id: string; slug: string; name: string }[];
}

/**
 * Apunta el bot al webhook de este despliegue (solo en producción, para que una vista previa no se lo lleve).
 * Desde ese momento getUpdates deja de funcionar y todo llega por /api/telegram/webhook.
 */
export async function ensureWebhook(origin: string): Promise<void> {
  if (process.env.VERCEL_ENV && process.env.VERCEL_ENV !== "production") return;
  if (!origin.startsWith("https://")) return;
  const url = `${origin}/api/telegram/webhook`;
  const { json } = await telegram("getWebhookInfo", {});
  if ((json.result as { url?: string } | undefined)?.url === url) return;
  await telegram("setWebhook", { url, secret_token: webhookSecret(), allowed_updates: ["message", "callback_query"], drop_pending_updates: false });
}

/** Descarga un archivo que mandaron al bot. */
export async function downloadFile(fileId: string): Promise<string> {
  const { json } = await telegram("getFile", { file_id: fileId });
  const path = (json.result as { file_path?: string } | undefined)?.file_path;
  if (!path) throw new Error("Telegram no devolvió el archivo");
  const res = await fetch(`https://api.telegram.org/file/bot${process.env.TELEGRAM_BOT_TOKEN}/${path}`, { signal: AbortSignal.timeout(10_000) });
  if (!res.ok) throw new Error(`Telegram: error ${res.status} al bajar el archivo`);
  return res.text();
}
