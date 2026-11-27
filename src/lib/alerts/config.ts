/**
 * Configuración de alertas de una marca (site_docs kind 'notifications', stage 'published').
 * La lee el trigger de la base al crear un pedido (ver supabase/migrations/0004_alerts.sql).
 * Este archivo lo usan el admin (navegador) y el servidor: no importa nada del servidor.
 */

export const CHANNELS = ["telegram", "email", "whatsapp"] as const;
export type ChannelKey = (typeof CHANNELS)[number];

export const EVENTS = [
  "order_new", "order_paid", "order_preparing", "order_ready", "order_awaiting_courier", "order_in_transit", "order_delivered", "order_cancelled",
  "party_new", "review_new",
] as const;
export type AlertEvent = (typeof EVENTS)[number];

/** Qué ve el equipo en «¿Qué nos avisa?» y en la tuerca de cada canal, agrupado. */
export const EVENT_GROUPS: { title: string; events: { key: AlertEvent; label: string; desc: string }[] }[] = [
  {
    title: "Pedidos",
    events: [
      { key: "order_new", label: "Nuevo pedido", desc: "Apenas el cliente confirma su compra (con tarjeta, cuando se aprueba el pago)" },
      { key: "order_paid", label: "Pago confirmado", desc: "Cuando alguien del equipo marca el pago de Yape o Plin como recibido" },
    ],
  },
  {
    title: "Cambios de estado",
    events: [
      { key: "order_preparing", label: "En preparación", desc: "El pedido pasó a preparación" },
      { key: "order_ready", label: "Listo", desc: "El pedido está armado" },
      { key: "order_awaiting_courier", label: "Esperando delivery", desc: "Listo y esperando que lo recoja el delivery" },
      { key: "order_in_transit", label: "En tránsito", desc: "El delivery ya va en camino" },
      { key: "order_delivered", label: "Entregado", desc: "El cliente ya lo recibió" },
      { key: "order_cancelled", label: "Cancelado", desc: "El pedido se canceló" },
    ],
  },
  {
    title: "Otros",
    events: [
      { key: "party_new", label: "Nuevo mensaje de contacto", desc: "Cuando alguien te escribe desde el formulario de Contacto" },
      { key: "review_new", label: "Nueva reseña", desc: "Cuando un cliente deja una reseña: la revisas y la publicas en Reseñas" },
    ],
  },
];

export const EVENT_LABEL = Object.fromEntries(EVENT_GROUPS.flatMap((g) => g.events.map((e) => [e.key, e.label]))) as Record<AlertEvent, string>;

const ALL_ON = Object.fromEntries(EVENTS.map((e) => [e, true])) as Record<AlertEvent, boolean>;

export type Recipient = { to: string; label: string };
/** events: lo que avisa este canal (tuerca «Configurar»). Lo que falta cuenta como prendido. */
export type ChannelConfig = { on: boolean; recipients: Recipient[]; events: Record<AlertEvent, boolean> };
export type AlertConfig = { channels: Record<ChannelKey, ChannelConfig>; events: Record<AlertEvent, boolean> };

export const CHANNEL_NAMES: Record<ChannelKey, string> = { telegram: "Telegram", email: "Correo", whatsapp: "WhatsApp" };

export const EMPTY_CONFIG: AlertConfig = {
  channels: {
    telegram: { on: false, recipients: [], events: ALL_ON },
    email: { on: false, recipients: [], events: ALL_ON },
    whatsapp: { on: false, recipients: [], events: ALL_ON },
  },
  events: ALL_ON,
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
      events: { ...ALL_ON, ...(c?.events ?? {}) },
    };
  }
  return { channels, events: { ...ALL_ON, ...(r.events ?? {}) } };
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
