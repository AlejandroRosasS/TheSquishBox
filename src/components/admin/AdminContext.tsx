"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { TenantBundle } from "@/tenants";
import type { AdminCatalog, AdminDemo, AdminProduct } from "@/lib/admin/types";
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
function adminProduct(p: Product): AdminProduct {
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

/** Catálogo editable (productos, líneas, costos). Se guarda en el navegador en esta fase. */
export function useAdminCatalog() {
  const { bundle, demo } = useAdmin();
  const initial: AdminCatalog = useMemo(
    () => ({
      lines: [...bundle.catalog.lines].sort((a, b) => a.order - b.order),
      products: bundle.catalog.products.map(adminProduct),
      costs: demo.costs,
      lineNotes: demo.lineNotes,
    }),
    [bundle, demo],
  );
  const [catalog, setCatalog, hydrated] = usePersisted<AdminCatalog>(dataKey(bundle.tenant.slug, "catalog"), initial);
  const reset = useCallback(() => setCatalog(initial), [initial, setCatalog]);
  return { catalog, setCatalog, hydrated, reset, initial };
}

// Pedidos (tienda y fiestas): de la base o de la demo. Viven en AdminOrders.tsx.
export { useOrders, useParty } from "./AdminOrders";
