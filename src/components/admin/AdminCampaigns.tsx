"use client";

import { useCallback, useEffect, useState } from "react";
import type { Campaign } from "@/lib/types";
import { dataKey, usePersisted } from "@/lib/admin/storage";
import { refreshStore } from "@/app/admin/actions";
import { useAdmin } from "./AdminContext";
import { useDb } from "./DbContext";

export type CampaignsState = {
  campaigns: Campaign[];
  /** Guarda la lista completa (crea, cambia y borra lo que haga falta). */
  save: (next: Campaign[]) => Promise<boolean>;
  hydrated: boolean;
  /** false si la base aún no tiene la tabla de campañas (falta la migración 0008). */
  available: boolean;
};

const EMPTY: Campaign[] = [];
const missingTable = (e: { code?: string }) => e.code === "PGRST205" || e.code === "42P01";
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

type Row = { id: string; name: string; starts_at: string; ends_at: string; prices: Campaign["prices"] | null };
const fromRow = (r: Row): Campaign => ({ id: r.id, name: r.name, startsAt: new Date(r.starts_at).toISOString(), endsAt: new Date(r.ends_at).toISOString(), prices: r.prices ?? {} });

/** Campañas de oferta de la marca: en la base con Supabase; en el navegador en modo demo. */
export function useCampaigns(): CampaignsState {
  const db = useDb();
  const local = useLocalCampaigns(!db);
  const remote = useDbCampaigns(!!db);
  return db ? remote : local;
}

function useLocalCampaigns(on: boolean): CampaignsState {
  const { bundle } = useAdmin();
  const [campaigns, set, hydrated] = usePersisted<Campaign[]>(dataKey(bundle.tenant.slug, "campaigns"), EMPTY);
  const save = useCallback(
    async (next: Campaign[]) => {
      if (on) set(next);
      return true;
    },
    [on, set],
  );
  return { campaigns, save, hydrated, available: true };
}

function useDbCampaigns(on: boolean): CampaignsState {
  const db = useDb();
  const { toast } = useAdmin();
  const ready = db?.state.phase === "ready" ? db.state : null;
  const tenantId = ready?.tenantId;
  const userId = ready?.user.id;
  const client = db?.client;
  const [campaigns, setCampaigns] = useState<Campaign[]>(EMPTY);
  const [hydrated, setHydrated] = useState(false);
  const [available, setAvailable] = useState(true);

  useEffect(() => {
    if (!on || !client || !tenantId) return;
    let alive = true;
    void client
      .from("price_campaigns")
      .select("id, name, starts_at, ends_at, prices")
      .eq("tenant_id", tenantId)
      .order("starts_at", { ascending: false })
      .then(({ data, error }) => {
        if (!alive) return;
        if (error) {
          if (missingTable(error)) setAvailable(false);
          else toast(`No se pudieron cargar las campañas: ${error.message}`);
        } else setCampaigns(((data ?? []) as Row[]).map(fromRow));
        setHydrated(true);
      });
    return () => {
      alive = false;
    };
  }, [on, client, tenantId, toast]);

  const save = useCallback(
    async (next: Campaign[]) => {
      if (!client || !tenantId || !userId) {
        toast("Ingresa al panel para guardar");
        return false;
      }
      if (!available) {
        toast("Las campañas necesitan la migración 0008_campaigns en Supabase");
        return false;
      }
      const ids = new Set(next.map((c) => c.id));
      const gone = campaigns.filter((c) => !ids.has(c.id)).map((c) => c.id);
      const changed = next.filter((c) => !same(campaigns.find((x) => x.id === c.id), c));
      try {
        if (gone.length) {
          const r = await client.from("price_campaigns").delete().eq("tenant_id", tenantId).in("id", gone);
          if (r.error) throw new Error(r.error.message);
        }
        if (changed.length) {
          const now = new Date().toISOString();
          const r = await client.from("price_campaigns").upsert(
            changed.map((c) => ({ id: c.id, tenant_id: tenantId, name: c.name, starts_at: c.startsAt, ends_at: c.endsAt, prices: c.prices, updated_at: now, updated_by: userId })),
          );
          if (r.error) throw new Error(r.error.message);
        }
        setCampaigns(next);
        await refreshStore();
        return true;
      } catch (e) {
        toast(`No se pudo guardar la campaña: ${e instanceof Error ? e.message : "error de conexión"}`);
        return false;
      }
    },
    [client, tenantId, userId, available, campaigns, toast],
  );

  return { campaigns, save, hydrated, available };
}
