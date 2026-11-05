"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { dataKey, usePersisted } from "@/lib/admin/storage";
import type { Pricer, SaleDraft } from "@/lib/sales/csv";
import { makePricer } from "@/lib/sales/pricer";
import { saleRow } from "@/lib/sales/rows";
import { useAdmin, useAdminCatalog } from "./AdminContext";
import { useCampaigns } from "./AdminCampaigns";
import { useDb } from "./DbContext";

export type ManualSaleLine = { productId: string; variantId: string; qty: number; price: number; campaignId?: string; campaign?: string; listPrice?: number };
export type ManualSale = {
  id: string;
  /** Referencia para no cargar dos veces la misma venta. */
  ref?: string;
  /** Fecha de la venta (AAAA-MM-DD, hora de Perú). Las guardadas antes en el navegador solo traen `date`. */
  day?: string;
  /** Fecha para mostrar: «5 nov». */
  date: string;
  channel: string;
  client: string;
  pay: string;
  lines: ManualSaleLine[];
  dIn: number;
  dOut: number;
  note: string;
  source?: "admin" | "csv" | "telegram";
};
export type NewSale = Omit<SaleDraft, "rows">;

export type SalesState = {
  sales: ManualSale[];
  /** Guarda ventas nuevas. Las que ya estaban (misma referencia) se saltan. null = no se pudo guardar. */
  add: (sales: NewSale[], source: "admin" | "csv") => Promise<{ added: number; skipped: number } | null>;
  hydrated: boolean;
  /** false si la base aún no tiene las columnas nuevas (falta la migración 0009). */
  available: boolean;
};

const EMPTY: ManualSale[] = [];
/** «5 nov» */
export const dayLabel = (day: string) => new Intl.DateTimeFormat("es-PE", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${day}T12:00:00Z`)).replace(".", "");
export { limaToday } from "@/lib/sales/pricer";
/** Referencia nueva para una venta registrada a mano. */
export const newRef = () => `m${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/** Ventas manuales: en la base con Supabase; en el navegador en modo demo. */
export function useManualSales(): SalesState {
  const db = useDb();
  const local = useLocalSales(!db);
  const remote = useDbSales(!!db);
  return db ? remote : local;
}

function useLocalSales(on: boolean): SalesState {
  const { bundle } = useAdmin();
  const [sales, set, hydrated] = usePersisted<ManualSale[]>(dataKey(bundle.tenant.slug, "sales"), EMPTY);
  const add = useCallback(
    async (next: NewSale[], source: "admin" | "csv") => {
      const refs = new Set(sales.map((s) => s.ref).filter(Boolean));
      const fresh = next.filter((s) => !refs.has(s.ref));
      if (on && fresh.length) set((prev) => [...prev, ...fresh.map((s): ManualSale => ({ id: s.ref, ref: s.ref, day: s.day, date: dayLabel(s.day), channel: s.channel, client: s.client, pay: s.pay, lines: s.lines, dIn: s.dIn, dOut: s.dOut, note: s.note, source }))]);
      return { added: fresh.length, skipped: next.length - fresh.length };
    },
    [on, sales, set],
  );
  return { sales, add, hydrated, available: true };
}

type Item = { product: string; variant: string; name?: string; variant_label?: string; qty: number; price: number | string; list_price?: number | string; campaign_id?: string; campaign?: string };
type Row = { id: string; ref: string | null; channel: string; items: Item[]; note: string | null; sold_at: string; client: string | null; pay: string | null; delivery_in: number | string; delivery_out: number | string; source: ManualSale["source"] };
const COLUMNS = "id, ref, channel, items, note, sold_at, client, pay, delivery_in, delivery_out, source";
const missingColumn = (e: { code?: string }) => ["PGRST204", "42703", "PGRST205", "42P01", "42P10"].includes(e.code ?? "");

function fromRow(r: Row): ManualSale {
  const day = new Date(new Date(r.sold_at).getTime() - 5 * 3600_000).toISOString().slice(0, 10);
  return {
    id: r.id, ref: r.ref ?? undefined, day, date: dayLabel(day), channel: r.channel, client: r.client ?? "", pay: r.pay ?? "", note: r.note ?? "",
    dIn: Number(r.delivery_in ?? 0), dOut: Number(r.delivery_out ?? 0), source: r.source,
    lines: (r.items ?? []).map((it) => ({
      productId: it.product, variantId: it.variant, qty: Number(it.qty ?? 1), price: Number(it.price ?? 0),
      ...(it.campaign_id ? { campaignId: it.campaign_id, campaign: it.campaign, listPrice: Number(it.list_price ?? it.price ?? 0) } : {}),
    })),
  };
}

function useDbSales(on: boolean): SalesState {
  const db = useDb();
  const { toast } = useAdmin();
  const { catalog } = useAdminCatalog();
  const ready = db?.state.phase === "ready" ? db.state : null;
  const tenantId = ready?.tenantId;
  const userId = ready?.user.id;
  const client = db?.client;
  const [sales, setSales] = useState<ManualSale[]>(EMPTY);
  const [hydrated, setHydrated] = useState(false);
  const [available, setAvailable] = useState(true);

  useEffect(() => {
    if (!on || !client || !tenantId) return;
    let alive = true;
    void client
      .from("manual_sales")
      .select(COLUMNS)
      .eq("tenant_id", tenantId)
      .order("sold_at", { ascending: true })
      .limit(5000)
      .then(({ data, error }) => {
        if (!alive) return;
        if (error) {
          if (missingColumn(error)) setAvailable(false);
          else toast(`No se pudieron cargar las ventas: ${error.message}`);
        } else setSales(((data ?? []) as Row[]).map(fromRow));
        setHydrated(true);
      });
    return () => {
      alive = false;
    };
  }, [on, client, tenantId, toast]);

  const add = useCallback(
    async (next: NewSale[], source: "admin" | "csv") => {
      if (!client || !tenantId || !userId) {
        toast("Ingresa al panel para guardar");
        return null;
      }
      if (!available) {
        toast("Las ventas necesitan la migración 0009_manual_sales en Supabase");
        return null;
      }
      const rows = next.map((s) => saleRow(s, { tenantId, catalog, source, userId }));
      const { data, error } = await client.from("manual_sales").upsert(rows, { onConflict: "tenant_id,ref", ignoreDuplicates: true }).select(COLUMNS);
      if (error) {
        if (missingColumn(error)) setAvailable(false);
        toast(missingColumn(error) ? "Las ventas necesitan la migración 0009_manual_sales en Supabase" : `No se pudieron guardar las ventas: ${error.message}`);
        return null;
      }
      const added = ((data ?? []) as Row[]).map(fromRow);
      setSales((prev) => [...prev, ...added]);
      return { added: added.length, skipped: next.length - added.length };
    },
    [client, tenantId, userId, available, catalog, toast],
  );

  return { sales, add, hydrated, available };
}

/** Precio de una opción en un día (campaña vigente o regular). Ver makePricer. */
export function usePricer(): Pricer {
  const { catalog } = useAdminCatalog();
  const { campaigns } = useCampaigns();
  return useMemo(() => makePricer(catalog, campaigns), [catalog, campaigns]);
}
