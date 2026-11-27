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
  /** false si falta la migración 0020 (tope de unidades por oferta). */
  limitsAvailable: boolean;
  /** Unidades vendidas a precio de oferta: {"<id de campaña>": {"<producto>": {"<opción>": n}}}. */
  sold: Record<string, Record<string, Record<string, number>>>;
};

const EMPTY: Campaign[] = [];
const missingTable = (e: { code?: string }) => e.code === "PGRST205" || e.code === "42P01";
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

type Row = { id: string; name: string; starts_at: string; ends_at: string; prices: Campaign["prices"] | null; limits?: Campaign["limits"] | null };
const fromRow = (r: Row): Campaign => ({
  id: r.id, name: r.name, startsAt: new Date(r.starts_at).toISOString(), endsAt: new Date(r.ends_at).toISOString(), prices: r.prices ?? {},
  ...(r.limits && Object.keys(r.limits).length ? { limits: r.limits } : {}),
});
const missingColumn = (e: { code?: string; message?: string }) => e.code === "42703" || /limits/.test(e.message ?? "");

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
  return { campaigns, save, hydrated, available: true, limitsAvailable: true, sold: {} };
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
  const [limitsAvailable, setLimitsAvailable] = useState(true);
  const [sold, setSold] = useState<CampaignsState["sold"]>({});

  useEffect(() => {
    if (!on || !client || !tenantId) return;
    let alive = true;
    const load = (cols: string) => client.from("price_campaigns").select(cols).eq("tenant_id", tenantId).order("starts_at", { ascending: false });
    void (async () => {
      let r = await load("id, name, starts_at, ends_at, prices, limits");
      // Sin la migración 0020 no hay columna de topes: las campañas siguen funcionando sin tope.
      if (r.error && missingColumn(r.error)) {
        if (alive) setLimitsAvailable(false);
        r = await load("id, name, starts_at, ends_at, prices");
      }
      if (!alive) return;
      const { data, error } = r;
      if (error) {
        if (missingTable(error)) setAvailable(false);
        else toast(`No se pudieron cargar las campañas: ${error.message}`);
      } else setCampaigns(((data ?? []) as unknown as Row[]).map(fromRow));
      setHydrated(true);
    })();
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
            changed.map((c) => ({
              id: c.id, tenant_id: tenantId, name: c.name, starts_at: c.startsAt, ends_at: c.endsAt, prices: c.prices,
              ...(limitsAvailable ? { limits: c.limits ?? {} } : {}),
              updated_at: now, updated_by: userId,
            })),
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
    [client, tenantId, userId, available, limitsAvailable, campaigns, toast],
  );

  // Vendidas a precio de oferta, solo de las campañas con algún tope (para «12 de 20 vendidas»).
  const limitedIds = campaigns.filter((c) => Object.keys(c.limits ?? {}).length).map((c) => c.id).join(",");
  useEffect(() => {
    if (!on || !client || !limitsAvailable || !limitedIds) return;
    let alive = true;
    void Promise.all(limitedIds.split(",").map(async (id) => [id, (await client.rpc("campaign_sold", { camp: id })).data] as const)).then((rows) => {
      if (!alive) return;
      const next: CampaignsState["sold"] = {};
      for (const [id, data] of rows) if (data && typeof data === "object") next[id] = data as Record<string, Record<string, number>>;
      setSold(next);
    });
    return () => {
      alive = false;
    };
  }, [on, client, limitsAvailable, limitedIds]);

  return { campaigns, save, hydrated, available, limitsAvailable, sold };
}
