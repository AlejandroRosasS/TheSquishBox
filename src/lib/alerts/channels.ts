import type { ChannelKey } from "./config";
import type { AlertMessage } from "./message";

/**
 * Envío por cada canal. Las cuentas son de la plataforma (una para todas las marcas) y viven en
 * variables del servidor; el nombre de la marca va dentro del mensaje. Ver docs/ALERTAS.md.
 */

/** migratedTo: el grupo de Telegram pasó a supergrupo y cambió de id; el aviso salió al id nuevo. */
export type SendResult = { ok: true; migratedTo?: string } | { ok: false; error: string; permanent?: boolean; retryAfterSec?: number; migratedTo?: string };

const env = (k: string) => process.env[k]?.trim() ?? "";

export function channelReady(ch: ChannelKey): boolean {
  if (ch === "telegram") return Boolean(env("TELEGRAM_BOT_TOKEN"));
  if (ch === "email") return Boolean(env("RESEND_API_KEY") && env("ALERTS_FROM_EMAIL"));
  return Boolean(env("WHATSAPP_TOKEN") && env("WHATSAPP_PHONE_NUMBER_ID"));
}

const NOT_READY: Record<ChannelKey, string> = {
  telegram: "Falta TELEGRAM_BOT_TOKEN en el servidor",
  email: "Faltan RESEND_API_KEY o ALERTS_FROM_EMAIL en el servidor",
  whatsapp: "Faltan WHATSAPP_TOKEN o WHATSAPP_PHONE_NUMBER_ID en el servidor",
};

async function readJson(res: Response): Promise<Record<string, unknown>> {
  try {
    return (await res.json()) as Record<string, unknown>;
  } catch {
    return {};
  }
}

const timeout = () => AbortSignal.timeout(10_000);

// ─────────── Telegram ───────────

export async function telegram(method: string, body: Record<string, unknown>) {
  const res = await fetch(`https://api.telegram.org/bot${env("TELEGRAM_BOT_TOKEN")}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    signal: timeout(),
  });
  return { status: res.status, json: await readJson(res) };
}

async function sendTelegram(chatId: string, m: AlertMessage, migrated = false): Promise<SendResult> {
  const text = [m.title, "", ...m.lines].join("\n");
  const button = m.url.startsWith("https://") ? { reply_markup: { inline_keyboard: [[{ text: "Ver en el panel", url: m.url }]] } } : {};
  const { status, json } = await telegram("sendMessage", { chat_id: chatId, text: m.url.startsWith("https://") ? text : `${text}\n\n${m.url}`, ...button });
  if (json.ok) return { ok: true };
  const params = (json.parameters ?? {}) as Record<string, unknown>;
  // Un grupo que pasa a supergrupo (al hacer admin a alguien, activar el historial, etc.) cambia de id:
  // Telegram avisa el id nuevo y se reenvía ahí. Quien llama guarda el id nuevo (ver migrateTelegramChat).
  if (params.migrate_to_chat_id && !migrated) {
    const newId = String(params.migrate_to_chat_id);
    const r = await sendTelegram(newId, m, true);
    return { ...r, migratedTo: newId };
  }
  const error = `Telegram: ${String(json.description ?? `error ${status}`)}`;
  const retry = Number(params.retry_after ?? 0);
  // 400 (chat no existe) y 403 (sacaron al bot del grupo) no se arreglan reintentando.
  return { ok: false, error, permanent: status === 400 || status === 403, retryAfterSec: retry || undefined };
}

// ─────────── Correo (Resend) ───────────

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

async function sendEmail(to: string, m: AlertMessage, brand: string, idempotencyKey?: string): Promise<SendResult> {
  const html = `<div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;font-size:15px;line-height:1.5;color:#1d1d1f">
<p style="font-size:18px;font-weight:700;margin:0 0 12px">${esc(m.title)}</p>
${m.lines.map((l) => `<p style="margin:0 0 4px">${esc(l)}</p>`).join("\n")}
<p style="margin:20px 0 0"><a href="${esc(m.url)}" style="display:inline-block;background:#1d1d1f;color:#fff;text-decoration:none;padding:12px 18px;border-radius:10px;font-weight:600">Ver en el panel</a></p>
</div>`;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${env("RESEND_API_KEY")}`,
      "content-type": "application/json",
      ...(idempotencyKey ? { "idempotency-key": idempotencyKey } : {}),
    },
    body: JSON.stringify({
      from: `${brand} <${env("ALERTS_FROM_EMAIL")}>`,
      to: [to],
      subject: m.title,
      text: [m.title, "", ...m.lines, "", `Ver en el panel: ${m.url}`].join("\n"),
      html,
    }),
    signal: timeout(),
  });
  if (res.ok) return { ok: true };
  const json = await readJson(res);
  const error = `Correo: ${String(json.message ?? `error ${res.status}`)}`;
  // 422 = datos inválidos (correo mal escrito, remitente sin verificar): reintentar no sirve.
  return { ok: false, error, permanent: res.status === 422 || res.status === 403 };
}

// ─────────── WhatsApp (Cloud API) ───────────

/**
 * Fuera de la ventana de 24 h, WhatsApp solo deja escribir con una plantilla aprobada.
 * WHATSAPP_TEMPLATE (categoría Utilidad) debe tener 3 variables: {{1}} marca, {{2}} título, {{3}} resumen.
 * Sin plantilla se manda texto libre, que solo llega si esa persona le escribió al número en las últimas 24 h.
 */
async function sendWhatsApp(to: string, m: AlertMessage, brand: string): Promise<SendResult> {
  const version = env("WHATSAPP_API_VERSION") || "v26.0";
  const template = env("WHATSAPP_TEMPLATE");
  const clean = (s: string) => s.replace(/[\n\t]+/g, " · ").replace(/ {4,}/g, "   ").slice(0, 900);
  const payload = template
    ? {
        type: "template",
        template: {
          name: template,
          language: { code: env("WHATSAPP_TEMPLATE_LANG") || "es" },
          components: [{ type: "body", parameters: [brand, m.title, m.oneLine].map((t) => ({ type: "text", text: clean(t) })) }],
        },
      }
    : { type: "text", text: { preview_url: false, body: [m.title, "", ...m.lines, "", m.url].join("\n") } };
  const res = await fetch(`https://graph.facebook.com/${version}/${env("WHATSAPP_PHONE_NUMBER_ID")}/messages`, {
    method: "POST",
    headers: { authorization: `Bearer ${env("WHATSAPP_TOKEN")}`, "content-type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", recipient_type: "individual", to, ...payload }),
    signal: timeout(),
  });
  const json = await readJson(res);
  if (res.ok) return { ok: true };
  const err = (json.error ?? {}) as Record<string, unknown>;
  const code = Number(err.code ?? 0);
  const error = `WhatsApp: ${String(err.message ?? `error ${res.status}`)}${code ? ` (${code})` : ""}`;
  // 131026 número sin WhatsApp, 131030 número no permitido en modo prueba, 132001 plantilla no existe, 131047 fuera de 24 h, 190 token vencido.
  return { ok: false, error, permanent: [131026, 131030, 132000, 132001, 131047, 190].includes(code) };
}

export async function sendAlert(ch: ChannelKey, to: string, m: AlertMessage, brand: string, idempotencyKey?: string): Promise<SendResult> {
  if (!channelReady(ch)) return { ok: false, error: NOT_READY[ch] };
  try {
    if (ch === "telegram") return await sendTelegram(to, m);
    if (ch === "email") return await sendEmail(to, m, brand, idempotencyKey);
    return await sendWhatsApp(to, m, brand);
  } catch (e) {
    return { ok: false, error: `${ch}: ${e instanceof Error ? e.message : "sin respuesta"}` };
  }
}
