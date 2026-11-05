import type { SupabaseClient } from "@supabase/supabase-js";
import { ORDER_COLUMNS, type OrderRow } from "@/lib/db/orders";
import { CHANNEL_NAMES, type ChannelKey } from "./config";
import { sendAlert } from "./channels";
import { orderMessage } from "./message";

type OutboxRow = {
  id: number;
  tenant_id: string;
  order_id: string | null;
  event: string;
  channel: ChannelKey;
  recipient: string;
  label: string;
  attempts: number;
};

/** Esperas entre reintentos (minutos). Tras el último, el aviso queda como fallido y se anota en el pedido. */
const BACKOFF_MIN = [1, 2, 5, 15, 30, 60, 120, 240, 480, 720];
export const MAX_ATTEMPTS = BACKOFF_MIN.length + 1;

export type DispatchResult = { sent: number; retried: number; failed: number };

/**
 * Envía los avisos pendientes (de todas las marcas). Se llama apenas entra un pedido,
 * cada minuto desde el cron de Supabase y cada vez que el panel recarga pedidos. Varias llamadas
 * a la vez no se pisan: claim_alerts reparte los avisos con `for update skip locked`.
 */
export async function dispatchAlerts(db: SupabaseClient, origin: string, budgetMs = 20_000): Promise<DispatchResult> {
  const started = Date.now();
  const out: DispatchResult = { sent: 0, retried: 0, failed: 0 };
  const brands = new Map<string, string>();

  while (Date.now() - started < budgetMs) {
    const { data, error } = await db.rpc("claim_alerts", { max_rows: 20 });
    if (error) throw new Error(error.message);
    const batch = (data ?? []) as OutboxRow[];
    if (!batch.length) break;

    const orderIds = [...new Set(batch.map((r) => r.order_id).filter(Boolean))] as string[];
    const { data: orders } = await db.from("orders").select(ORDER_COLUMNS).in("id", orderIds);
    const byId = new Map(((orders ?? []) as OrderRow[]).map((o) => [o.id, o]));
    const missing = [...new Set(batch.map((r) => r.tenant_id))].filter((t) => !brands.has(t));
    if (missing.length) {
      const { data: ts } = await db.from("tenants").select("id, name").in("id", missing);
      for (const t of ts ?? []) brands.set(t.id as string, t.name as string);
    }

    await Promise.all(
      batch.map(async (row) => {
        const order = row.order_id ? byId.get(row.order_id) : undefined;
        const channel = CHANNEL_NAMES[row.channel];
        if (!order) {
          // El pedido se borró: ya no hay nada que avisar.
          await db.from("alert_outbox").update({ status: "failed", last_error: "El pedido ya no existe" }).eq("id", row.id);
          return;
        }
        const brand = brands.get(row.tenant_id) ?? "";
        const r = await sendAlert(row.channel, row.recipient, orderMessage(order, origin), brand, `alert-${row.id}`);
        if (r.ok) {
          out.sent++;
          await db.from("alert_outbox").update({ status: "sent", sent_at: new Date().toISOString(), last_error: null }).eq("id", row.id);
          await logEvent(db, row, `Aviso enviado por ${channel} a ${row.label}`);
          return;
        }
        const last = r.permanent || row.attempts >= MAX_ATTEMPTS;
        if (last) {
          out.failed++;
          await db.from("alert_outbox").update({ status: "failed", last_error: r.error }).eq("id", row.id);
          await logEvent(db, row, `No se pudo avisar por ${channel} a ${row.label}: ${r.error}`);
          return;
        }
        out.retried++;
        const waitMin = Math.max(BACKOFF_MIN[row.attempts - 1] ?? 720, (r.retryAfterSec ?? 0) / 60);
        await db
          .from("alert_outbox")
          .update({ status: "pending", last_error: r.error, next_attempt_at: new Date(Date.now() + waitMin * 60_000).toISOString() })
          .eq("id", row.id);
        // Solo se anota el primer tropiezo, para no llenar la actividad del pedido.
        if (row.attempts === 1) await logEvent(db, row, `Reintentando el aviso por ${channel} a ${row.label} (${r.error})`);
      }),
    );
  }
  return out;
}

async function logEvent(db: SupabaseClient, row: OutboxRow, text: string) {
  if (!row.order_id) return;
  await db.from("order_events").insert({ tenant_id: row.tenant_id, order_id: row.order_id, kind: "alert", text });
}
