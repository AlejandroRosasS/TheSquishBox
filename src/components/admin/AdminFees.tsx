"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { dataKey, usePersisted } from "@/lib/admin/storage";
import { DEFAULT_FEES, normalizeFees, type PaymentFees } from "@/lib/sales/fees";
import { useAdmin } from "./AdminContext";
import { useDb } from "./DbContext";

export type FeesState = { fees: PaymentFees; hydrated: boolean; save: (next: PaymentFees) => Promise<boolean> };

/**
 * IGV y comisiones de la marca. Con Supabase viven en site_docs kind 'settings' (published, solo el equipo),
 * junto a las tarifas de delivery: al guardar se relee el documento y solo se cambia `paymentFees`.
 * En modo demo, en el navegador.
 */
export function usePaymentFees(): FeesState {
  const { bundle, toast } = useAdmin();
  const db = useDb();
  const [local, setLocal, localHydrated] = usePersisted<unknown>(dataKey(bundle.tenant.slug, "payment-fees"), null);
  const ready = db?.state.phase === "ready" ? db.state : null;
  const tenantId = ready?.tenantId;
  const client = db?.client;
  const [remote, setRemote] = useState<PaymentFees | null>(null);
  const localFees = useMemo(() => normalizeFees(local), [local]);

  useEffect(() => {
    if (!client || !tenantId) return;
    let alive = true;
    void client
      .from("site_docs")
      .select("body")
      .eq("tenant_id", tenantId)
      .eq("kind", "settings")
      .eq("stage", "published")
      .maybeSingle()
      .then(({ data, error }) => {
        if (!alive) return;
        if (error) toast(`No se pudieron leer las comisiones: ${error.message}`);
        setRemote(normalizeFees((data?.body as { paymentFees?: unknown } | null)?.paymentFees));
      });
    return () => {
      alive = false;
    };
  }, [client, tenantId, toast]);

  const save = useCallback(
    async (next: PaymentFees) => {
      if (!db) {
        setLocal(next);
        return true;
      }
      if (!client || !tenantId) return false;
      const cur = await client.from("site_docs").select("body").eq("tenant_id", tenantId).eq("kind", "settings").eq("stage", "published").maybeSingle();
      if (cur.error) {
        toast(`No se guardó: ${cur.error.message}`);
        return false;
      }
      const body = { ...((cur.data?.body as Record<string, unknown> | null) ?? {}), paymentFees: next };
      const { error } = await client
        .from("site_docs")
        .upsert({ tenant_id: tenantId, kind: "settings", stage: "published", body, updated_at: new Date().toISOString(), updated_by: ready?.user.id });
      if (error) {
        toast(`No se guardó: ${error.message}`);
        return false;
      }
      setRemote(next);
      return true;
    },
    [db, client, tenantId, ready?.user.id, setLocal, toast],
  );

  if (db) return { fees: remote ?? DEFAULT_FEES, hydrated: !!remote, save };
  return { fees: localFees, hydrated: localHydrated, save };
}
