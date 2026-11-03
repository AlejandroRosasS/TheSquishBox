import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Culqi (tarjeta). Solo servidor: aquí se usa la llave secreta de la marca.
 * Cada marca cobra con su propia cuenta de Culqi (tabla payment_accounts).
 */

const API = "https://api.culqi.com/v2";

export type CulqiAccount = { tenantId: string; publicKey: string; secretKey: string; live: boolean; enabled: boolean };

export type CulqiCharge = {
  object: "charge";
  id: string;
  amount: number;
  amount_refunded?: number;
  currency_code?: string;
  currency?: string;
  email?: string;
  paid?: boolean;
  outcome?: { type?: string; code?: string; user_message?: string; merchant_message?: string };
  response_code?: string;
  state?: string;
  metadata?: Record<string, string>;
  source?: { card_number?: string; last_four?: string; iin?: { card_brand?: string } };
};

/** Respuesta de error de Culqi (o la que pide autenticación 3DS: action_code "REVIEW"). */
export type CulqiError = { object?: string; type?: string; code?: string; decline_code?: string; user_message?: string; merchant_message?: string; action_code?: string };

export type ChargeResult =
  | { kind: "paid"; charge: CulqiCharge }
  | { kind: "review" } // el banco pide 3DS: la tienda autentica y vuelve a intentar
  | { kind: "declined"; message: string; code: string };

export async function culqiAccount(db: SupabaseClient, slug: string): Promise<CulqiAccount | null> {
  const { data: t } = await db.from("tenants").select("id").eq("slug", slug).maybeSingle();
  if (!t) return null;
  const { data } = await db
    .from("payment_accounts")
    .select("public_key, secret_key, live, enabled")
    .eq("tenant_id", t.id)
    .eq("provider", "culqi")
    .maybeSingle();
  if (!data) return null;
  return { tenantId: t.id, publicKey: data.public_key, secretKey: data.secret_key, live: data.live, enabled: data.enabled };
}

async function call<T>(secret: string, path: string, body?: unknown): Promise<{ ok: boolean; status: number; json: T }> {
  const res = await fetch(`${API}${path}`, {
    method: body ? "POST" : "GET",
    headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  const json = (await res.json().catch(() => ({}))) as T;
  return { ok: res.ok, status: res.status, json };
}

export type ChargeInput = {
  token: string;
  amountCents: number;
  email: string;
  description: string;
  metadata: Record<string, string>;
  customer: { name: string; phone: string; address: string };
  deviceId?: string | null;
  authentication3DS?: Record<string, unknown>;
};

export async function createCharge(acct: CulqiAccount, input: ChargeInput): Promise<ChargeResult> {
  const [first, ...rest] = input.customer.name.trim().split(/\s+/);
  const body: Record<string, unknown> = {
    amount: input.amountCents,
    currency_code: "PEN",
    email: input.email,
    source_id: input.token,
    description: input.description.slice(0, 80),
    metadata: input.metadata,
    antifraud_details: {
      first_name: first || "Cliente",
      last_name: rest.join(" ") || first || "Cliente",
      phone_number: input.customer.phone.replace(/\D/g, ""),
      address: input.customer.address || "Lima",
      address_city: "Lima",
      country_code: "PE",
      ...(input.deviceId ? { device_finger_print_id: input.deviceId } : {}),
    },
  };
  if (input.authentication3DS) body.authentication_3DS = input.authentication3DS;

  const r = await call<CulqiCharge & CulqiError>(acct.secretKey, "/charges", body);
  if (r.ok && r.json.object === "charge" && chargeSucceeded(r.json)) {
    return { kind: "paid", charge: r.json };
  }
  // Culqi pide 3DS con una respuesta 2xx que no es un cargo (action_code "REVIEW").
  if (r.json.action_code === "REVIEW" || (r.ok && r.json.object !== "charge" && !input.authentication3DS)) return { kind: "review" };
  return {
    kind: "declined",
    code: r.json.decline_code || r.json.code || r.json.outcome?.code || String(r.status),
    message: r.json.user_message || r.json.outcome?.user_message || "Tu banco no aprobó el pago.",
  };
}

/**
 * ¿El cobro fue aprobado? Culqi responde `paid: false` en cargos recién autorizados (se liquidan después),
 * así que se mira el resultado de la autorización: venta_exitosa / AUT0000.
 */
export function chargeSucceeded(c: CulqiCharge): boolean {
  return (
    c.paid === true ||
    c.outcome?.type === "venta_exitosa" ||
    c.outcome?.code === "AUT0000" ||
    c.response_code === "venta_exitosa" ||
    /^exitosa$/i.test(c.state ?? "")
  );
}

export async function getCharge(acct: CulqiAccount, id: string): Promise<CulqiCharge | null> {
  if (!/^chr_(test|live)_[A-Za-z0-9]+$/.test(id)) return null;
  const r = await call<CulqiCharge>(acct.secretKey, `/charges/${id}`);
  return r.ok && r.json.object === "charge" ? r.json : null;
}

export const toCents = (soles: number) => Math.round(Number(soles) * 100);

/** Texto corto para la actividad del pedido: "Visa •••• 1111". */
export function cardLabel(c: CulqiCharge) {
  const brand = c.source?.iin?.card_brand;
  const last = c.source?.last_four || c.source?.card_number?.slice(-4);
  return [brand, last ? `•••• ${last}` : ""].filter(Boolean).join(" ");
}

/**
 * Marca el pedido como pagado si el cobro coincide (monto, pedido y marca). Idempotente:
 * lo llaman el cobro y el webhook, el que llegue primero gana.
 */
export async function markPaid(db: SupabaseClient, acct: CulqiAccount, orderId: string, charge: CulqiCharge): Promise<boolean> {
  const { data: o } = await db
    .from("orders")
    .select("id, total, payment_status, payment_ref")
    .eq("id", orderId)
    .eq("tenant_id", acct.tenantId)
    .maybeSingle();
  if (!o) return false;
  if (o.payment_status === "paid") return o.payment_ref === charge.id;
  // El monto debe coincidir; el pedido, si Culqi lo devuelve en metadata.
  if (Number(charge.amount) !== toCents(o.total)) return false;
  if (charge.metadata?.order_id && charge.metadata.order_id !== orderId) return false;
  const { data: upd, error } = await db
    .from("orders")
    .update({ payment_status: "paid", payment_method: "tarjeta", payment_ref: charge.id })
    .eq("id", orderId)
    .neq("payment_status", "paid")
    .select("id");
  if (error) throw new Error(error.message);
  if (upd?.length) {
    const card = cardLabel(charge);
    await db.from("order_events").insert({
      tenant_id: acct.tenantId,
      order_id: orderId,
      kind: "paid",
      text: `Pago con tarjeta aprobado por Culqi${card ? ` · ${card}` : ""}${acct.live ? "" : " (modo prueba)"}`,
    });
  }
  return true;
}
