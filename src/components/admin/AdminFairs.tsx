"use client";

import { useCallback, useEffect, useState } from "react";
import type { Fair } from "@/lib/fairs";
import { dataKey, usePersisted } from "@/lib/admin/storage";
import { useAdmin } from "./AdminContext";
import { useDb } from "./DbContext";

export type FairsState = {
  fairs: Fair[];
  /** Crea o actualiza una feria. */
  save: (fair: Fair) => Promise<boolean>;
  remove: (id: string) => Promise<boolean>;
  hydrated: boolean;
  /** false si la base aún no tiene la tabla de ferias (falta la migración 0012). */
  available: boolean;
};

const EMPTY: Fair[] = [];
const missingTable = (e: { code?: string }) => e.code === "PGRST205" || e.code === "42P01";

type Row = { id: string; name: string; place: string | null; starts_on: string; ends_on: string; costs: Fair["costs"] | null; note: string | null; created_at: string };
const fromRow = (r: Row): Fair => ({
  id: r.id, name: r.name, place: r.place ?? "", startsOn: r.starts_on, endsOn: r.ends_on, note: r.note ?? "", createdAt: r.created_at,
  costs: (r.costs ?? []).map((c) => ({ label: String(c.label ?? ""), amount: Number(c.amount) || 0 })),
});
const sortFairs = (list: Fair[]) => [...list].sort((a, b) => b.startsOn.localeCompare(a.startsOn) || b.createdAt.localeCompare(a.createdAt));

/** Ferias y eventos de la marca: en la base con Supabase; en el navegador en modo demo. */
export function useFairs(): FairsState {
  const db = useDb();
  const local = useLocalFairs(!db);
  const remote = useDbFairs(!!db);
  return db ? remote : local;
}

function useLocalFairs(on: boolean): FairsState {
  const { bundle } = useAdmin();
  const [fairs, set, hydrated] = usePersisted<Fair[]>(dataKey(bundle.tenant.slug, "fairs"), EMPTY);
  const save = useCallback(
    async (f: Fair) => {
      if (on) set((prev) => sortFairs([...prev.filter((x) => x.id !== f.id), f]));
      return true;
    },
    [on, set],
  );
  const remove = useCallback(
    async (id: string) => {
      if (on) set((prev) => prev.filter((x) => x.id !== id));
      return true;
    },
    [on, set],
  );
  return { fairs, save, remove, hydrated, available: true };
}

function useDbFairs(on: boolean): FairsState {
  const db = useDb();
  const { toast } = useAdmin();
  const ready = db?.state.phase === "ready" ? db.state : null;
  const tenantId = ready?.tenantId;
  const userId = ready?.user.id;
  const client = db?.client;
  const [fairs, setFairs] = useState<Fair[]>(EMPTY);
  const [hydrated, setHydrated] = useState(false);
  const [available, setAvailable] = useState(true);

  useEffect(() => {
    if (!on || !client || !tenantId) return;
    let alive = true;
    void client
      .from("fairs")
      .select("id, name, place, starts_on, ends_on, costs, note, created_at")
      .eq("tenant_id", tenantId)
      .then(({ data, error }) => {
        if (!alive) return;
        if (error) {
          if (missingTable(error)) setAvailable(false);
          else toast(`No se pudieron cargar las ferias: ${error.message}`);
        } else setFairs(sortFairs(((data ?? []) as Row[]).map(fromRow)));
        setHydrated(true);
      });
    return () => {
      alive = false;
    };
  }, [on, client, tenantId, toast]);

  const ok = useCallback(() => {
    if (!client || !tenantId || !userId) {
      toast("Ingresa al panel para guardar");
      return false;
    }
    if (!available) {
      toast("Las ferias necesitan la migración 0012_fairs en Supabase");
      return false;
    }
    return true;
  }, [client, tenantId, userId, available, toast]);

  const save = useCallback(
    async (f: Fair) => {
      if (!ok() || !client) return false;
      const { data, error } = await client
        .from("fairs")
        .upsert({ id: f.id, tenant_id: tenantId, name: f.name, place: f.place || null, starts_on: f.startsOn, ends_on: f.endsOn, costs: f.costs, note: f.note || null, updated_at: new Date().toISOString(), updated_by: userId })
        .select("id, name, place, starts_on, ends_on, costs, note, created_at")
        .single();
      if (error) {
        if (missingTable(error)) setAvailable(false);
        toast(`No se pudo guardar la feria: ${error.message}`);
        return false;
      }
      const saved = fromRow(data as Row);
      setFairs((prev) => sortFairs([...prev.filter((x) => x.id !== saved.id), saved]));
      return true;
    },
    [ok, client, tenantId, userId, toast],
  );

  const remove = useCallback(
    async (id: string) => {
      if (!ok() || !client) return false;
      const { error } = await client.from("fairs").delete().eq("tenant_id", tenantId).eq("id", id);
      if (error) {
        toast(`No se pudo borrar la feria: ${error.message}`);
        return false;
      }
      setFairs((prev) => prev.filter((x) => x.id !== id));
      return true;
    },
    [ok, client, tenantId, toast],
  );

  return { fairs, save, remove, hydrated, available };
}
