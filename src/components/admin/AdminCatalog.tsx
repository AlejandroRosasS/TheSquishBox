"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { AdminCatalog } from "@/lib/admin/types";
import { dataKey, usePersisted } from "@/lib/admin/storage";
import { loadCatalog, saveCatalogDiff } from "@/lib/admin/catalogDb";
import { refreshStore } from "@/app/admin/actions";
import { AdminCatalogCtx, adminProduct, useAdmin, type CatalogCtx } from "./AdminContext";
import { useDb } from "./DbContext";

type Next = AdminCatalog | ((prev: AdminCatalog) => AdminCatalog);

/**
 * Catálogo del admin.
 * - Con Supabase (sesión del equipo): se lee de la base y cada cambio se guarda ahí; la tienda se refresca sola.
 * - Modo demo: se guarda en el navegador.
 */
export function AdminCatalogProvider({ children }: { children: ReactNode }) {
  const db = useDb();
  return db ? <DbCatalogProvider>{children}</DbCatalogProvider> : <LocalCatalogProvider>{children}</LocalCatalogProvider>;
}

function useInitial(): AdminCatalog {
  const { bundle, demo } = useAdmin();
  return useMemo(
    () => ({
      lines: [...bundle.catalog.lines].sort((a, b) => a.order - b.order),
      products: bundle.catalog.products.map(adminProduct),
      costs: demo.costs,
      lineNotes: demo.lineNotes,
    }),
    [bundle, demo],
  );
}

function LocalCatalogProvider({ children }: { children: ReactNode }) {
  const { bundle } = useAdmin();
  const initial = useInitial();
  const [catalog, setCatalog, hydrated] = usePersisted<AdminCatalog>(dataKey(bundle.tenant.slug, "catalog"), initial);
  const value = useMemo<CatalogCtx>(() => ({ catalog, setCatalog, hydrated, saving: false }), [catalog, setCatalog, hydrated]);
  return <AdminCatalogCtx.Provider value={value}>{children}</AdminCatalogCtx.Provider>;
}

const EMPTY: AdminCatalog = { lines: [], products: [], costs: {}, lineNotes: {} };

function DbCatalogProvider({ children }: { children: ReactNode }) {
  const db = useDb()!;
  const { toast } = useAdmin();
  const ready = db.state.phase === "ready" ? db.state : null;
  const tenantId = ready?.tenantId;
  const userId = ready?.user.id;
  const client = db.client;

  const [catalog, setState] = useState<AdminCatalog>(EMPTY);
  const [hydrated, setHydrated] = useState(false);
  const [pending, setPending] = useState(0);
  // Lo último confirmado por la base, los ids de producto y la cola de guardado (un cambio a la vez).
  const saved = useRef<AdminCatalog>(EMPTY);
  const current = useRef<AdminCatalog>(EMPTY);
  const ids = useRef<Record<string, string>>({});
  const queue = useRef<Promise<void>>(Promise.resolve());

  const reload = useCallback(async () => {
    if (!tenantId) return;
    const r = await loadCatalog(client, tenantId);
    saved.current = r.catalog;
    current.current = r.catalog;
    ids.current = r.ids;
    setState(r.catalog);
    setHydrated(true);
  }, [client, tenantId]);

  useEffect(() => {
    if (!tenantId) return;
    Promise.resolve().then(reload).catch((e) => toast(`No se pudo cargar el catálogo: ${e instanceof Error ? e.message : "error de conexión"}`));
  }, [tenantId, reload, toast]);

  const setCatalog = useCallback(
    (next: Next) => {
      if (!tenantId || !userId) return toast("Ingresa al panel para guardar");
      const value = typeof next === "function" ? next(current.current) : next;
      current.current = value;
      setState(value);
      setPending((n) => n + 1);
      queue.current = queue.current.then(async () => {
        try {
          const r = await saveCatalogDiff(client, tenantId, userId, saved.current, value, ids.current);
          ids.current = r.ids;
          // Las opciones nuevas reciben su id de la base (lo usa el checkout).
          const withIds: AdminCatalog = Object.keys(r.variantIds).length
            ? { ...value, products: value.products.map((p) => (r.variantIds[p.id] ? { ...p, variants: p.variants.map((v) => ({ ...v, dbId: r.variantIds[p.id][v.id] ?? v.dbId })) } : p)) }
            : value;
          saved.current = withIds;
          if (current.current === value) {
            current.current = withIds;
            setState(withIds);
          }
          await refreshStore();
        } catch (e) {
          toast(`No se pudo guardar: ${e instanceof Error ? e.message : "error de conexión"}. Recargamos lo último guardado.`);
          await reload().catch(() => {});
        } finally {
          setPending((n) => n - 1);
        }
      });
    },
    [client, tenantId, userId, toast, reload],
  );

  const value = useMemo<CatalogCtx>(() => ({ catalog, setCatalog, hydrated, saving: pending > 0 }), [catalog, setCatalog, hydrated, pending]);
  return <AdminCatalogCtx.Provider value={value}>{children}</AdminCatalogCtx.Provider>;
}
