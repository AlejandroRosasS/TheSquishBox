"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { TenantBundle } from "@/tenants";
import type { AdminCatalog, AdminDemo, AdminProduct, DemoOrder, PartyRequest } from "@/lib/admin/types";
import type { Product } from "@/lib/types";
import { dataKey, usePersisted } from "@/lib/admin/storage";

type Ctx = { bundle: TenantBundle; demo: AdminDemo; toast: (msg: string) => void };
const AdminCtx = createContext<Ctx | null>(null);

export function AdminProvider({ bundle, demo, children }: { bundle: TenantBundle; demo: AdminDemo; children: ReactNode }) {
  const [msg, setMsg] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toast = useCallback((m: string) => {
    setMsg(m);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setMsg(null), 3200);
  }, []);
  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);
  const value = useMemo(() => ({ bundle, demo, toast }), [bundle, demo, toast]);
  return (
    <AdminCtx.Provider value={value}>
      {children}
      <div aria-live="polite" role="status" className="sr-only">{msg}</div>
      {msg && <div className="a-toast" aria-hidden="true">{msg}</div>}
    </AdminCtx.Provider>
  );
}

export function useAdmin(): Ctx {
  const v = useContext(AdminCtx);
  if (!v) throw new Error("useAdmin fuera de AdminProvider");
  return v;
}

/** Producto de la tienda → producto editable. Sin control de stock = las unidades no se cuentan (quedan en 0 si luego se prende). */
export function adminProduct(p: Product): AdminProduct {
  const tracked = p.trackStock !== false;
  return {
    ...p,
    variants: tracked ? p.variants : p.variants.map((v) => ({ ...v, stock: 0 })),
    stockMode: tracked ? "stock" : "none",
    available: p.status !== "sold_out",
    lowAlert: true,
    igSynced: true,
    igImages: p.images,
    photosSynced: true,
  };
}

export type CatalogCtx = {
  catalog: AdminCatalog;
  /** Guarda el catálogo (en la base con Supabase; en el navegador en modo demo). */
  setCatalog: (next: AdminCatalog | ((prev: AdminCatalog) => AdminCatalog)) => void;
  /** false mientras se carga lo guardado. */
  hydrated: boolean;
  /** true mientras hay cambios yendo a la base. */
  saving: boolean;
};

export const AdminCatalogCtx = createContext<CatalogCtx | null>(null);

/** Catálogo editable (productos, líneas, costos y notas). Lo da AdminCatalogProvider. */
export function useAdminCatalog(): CatalogCtx {
  const v = useContext(AdminCatalogCtx);
  if (!v) throw new Error("useAdminCatalog fuera de AdminCatalogProvider");
  return v;
}

/** Cambios hechos a los pedidos de ejemplo (estado, delivery real, notas…). */
export function useOrders() {
  const { bundle, demo } = useAdmin();
  const [patches, setPatches, hydrated] = usePersisted<Record<string, Partial<DemoOrder> & { link?: string; refund?: string }>>(
    dataKey(bundle.tenant.slug, "orders"),
    {},
  );
  const orders = useMemo(() => demo.orders.map((o) => ({ ...o, link: "none", refund: "none", ...(patches[o.id] ?? {}) })), [demo, patches]);
  const update = useCallback(
    (id: string, patch: Partial<DemoOrder> & { link?: string; refund?: string }) =>
      setPatches((prev) => ({ ...prev, [id]: { ...(prev[id] ?? {}), ...patch } })),
    [setPatches],
  );
  return { orders, update, hydrated };
}

export function useParty() {
  const { bundle, demo } = useAdmin();
  const [patches, setPatches] = usePersisted<Record<string, Partial<PartyRequest>>>(dataKey(bundle.tenant.slug, "party"), {});
  const requests = useMemo(() => demo.partyRequests.map((r) => ({ ...r, ...(patches[r.id] ?? {}) })), [demo, patches]);
  const update = useCallback(
    (id: string, patch: Partial<PartyRequest>) => setPatches((prev) => ({ ...prev, [id]: { ...(prev[id] ?? {}), ...patch } })),
    [setPatches],
  );
  return { requests, update };
}
