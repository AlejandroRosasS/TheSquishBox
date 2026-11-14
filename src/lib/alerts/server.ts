import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeConfig, type AlertConfig } from "./config";
import { telegram } from "./channels";

export async function readConfig(db: SupabaseClient, tenantId: string): Promise<AlertConfig> {
  const { data } = await db.from("site_docs").select("body").eq("tenant_id", tenantId).eq("kind", "notifications").eq("stage", "published").maybeSingle();
  return normalizeConfig(data?.body);
}

export async function writeConfig(db: SupabaseClient, tenantId: string, cfg: AlertConfig) {
  const { error } = await db
    .from("site_docs")
    .upsert({ tenant_id: tenantId, kind: "notifications", stage: "published", body: cfg, updated_at: new Date().toISOString() });
  if (error) throw new Error(error.message);
}

/**
 * Un grupo de Telegram pasó a supergrupo y cambió de id: se reemplaza el id viejo por el nuevo en los
 * destinatarios de todas las marcas que lo tenían y en los avisos que siguen en cola.
 */
export async function migrateTelegramChat(db: SupabaseClient, oldId: string, newId: string) {
  if (!oldId || !newId || oldId === newId) return;
  const { data } = await db.from("site_docs").select("tenant_id").eq("kind", "notifications").eq("stage", "published");
  for (const { tenant_id } of data ?? []) {
    const cfg = await readConfig(db, tenant_id as string);
    const list = cfg.channels.telegram.recipients;
    if (!list.some((r) => r.to === oldId)) continue;
    const hasNew = list.some((r) => r.to === newId);
    cfg.channels.telegram.recipients = hasNew ? list.filter((r) => r.to !== oldId) : list.map((r) => (r.to === oldId ? { ...r, to: newId } : r));
    await writeConfig(db, tenant_id as string, cfg);
  }
  await db.from("alert_outbox").update({ recipient: newId }).eq("channel", "telegram").eq("recipient", oldId).in("status", ["pending", "sending"]);
}

let botName: string | null = null;

/** @usuario del bot de alertas (se pregunta una vez a Telegram). */
export async function telegramBotName(): Promise<string | null> {
  if (botName) return botName;
  if (!process.env.TELEGRAM_BOT_TOKEN?.trim()) return null;
  try {
    const { json } = await telegram("getMe", {});
    const u = (json.result as { username?: string } | undefined)?.username;
    if (u) botName = u;
  } catch {
    // Sin red o token inválido: la pantalla lo muestra como no conectado.
  }
  return botName;
}
