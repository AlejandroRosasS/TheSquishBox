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
