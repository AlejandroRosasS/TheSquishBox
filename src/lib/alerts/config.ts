/**
 * Configuración de alertas de una marca (site_docs kind 'notifications', stage 'published').
 * La lee el trigger de la base al crear un pedido (ver supabase/migrations/0004_alerts.sql).
 * Este archivo lo usan el admin (navegador) y el servidor: no importa nada del servidor.
 */

export const CHANNELS = ["telegram", "email", "whatsapp"] as const;
export type ChannelKey = (typeof CHANNELS)[number];

export const EVENTS = ["order_new", "party_new", "review_new"] as const;
export type AlertEvent = (typeof EVENTS)[number];

export type Recipient = { to: string; label: string };
export type ChannelConfig = { on: boolean; recipients: Recipient[] };
export type AlertConfig = { channels: Record<ChannelKey, ChannelConfig>; events: Record<AlertEvent, boolean> };

export const CHANNEL_NAMES: Record<ChannelKey, string> = { telegram: "Telegram", email: "Correo", whatsapp: "WhatsApp" };

export const EMPTY_CONFIG: AlertConfig = {
  channels: { telegram: { on: false, recipients: [] }, email: { on: false, recipients: [] }, whatsapp: { on: false, recipients: [] } },
  events: { order_new: true, party_new: true, review_new: true },
};

/** Completa lo que falte (documentos viejos o vacíos). */
export function normalizeConfig(raw: unknown): AlertConfig {
  const r = (raw ?? {}) as Partial<AlertConfig>;
  const channels = { ...EMPTY_CONFIG.channels };
  for (const k of CHANNELS) {
    const c = r.channels?.[k];
    channels[k] = {
      on: Boolean(c?.on),
      recipients: Array.isArray(c?.recipients)
        ? c.recipients.filter((x) => x && typeof x.to === "string" && x.to).map((x) => ({ to: x.to, label: x.label || x.to }))
        : [],
    };
  }
  return { channels, events: { ...EMPTY_CONFIG.events, ...(r.events ?? {}) } };
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * Valida y normaliza lo que escribe el equipo. WhatsApp: número peruano de 9 dígitos
 * (se le agrega 51) o internacional con código de país.
 */
export function parseRecipient(channel: Exclude<ChannelKey, "telegram">, input: string): Recipient | { error: string } {
  const s = input.trim();
  if (channel === "email") {
    if (!EMAIL_RE.test(s)) return { error: "Revisa el correo: debe verse como nombre@dominio.com" };
    return { to: s.toLowerCase(), label: s.toLowerCase() };
  }
  let d = s.replace(/\D/g, "");
  if (d.length === 9 && d.startsWith("9")) d = `51${d}`;
  if (d.length < 10 || d.length > 15) return { error: "Revisa el número: 9 dígitos (celular de Perú) o con código de país" };
  const label = d.startsWith("51") && d.length === 11 ? `+51 ${d.slice(2, 5)} ${d.slice(5, 8)} ${d.slice(8)}` : `+${d}`;
  return { to: d, label };
}
