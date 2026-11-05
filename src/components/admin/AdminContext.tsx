"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { TenantBundle } from "@/tenants";
import type { AdminCatalog, AdminDemo, AdminProduct } from "@/lib/admin/types";
import type { Product } from "@/lib/types";

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

// Pedidos (tienda y fiestas): de la base o de la demo. Viven en AdminOrders.tsx.
export { useOrders, useParty } from "./AdminOrders";
