"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { TenantBundle } from "@/tenants";
import type { Campaign } from "@/lib/types";
import { storeCampaignsFrom, withLiveLeft } from "@/lib/campaigns";

const Ctx = createContext<TenantBundle | null>(null);

/**
 * `live`: en la tienda pública, si alguna oferta tiene tope de unidades, se pregunta a la base cuántas
 * quedan (la página puede venir del caché). Si una oferta se agotó, la opción vuelve a su precio regular.
 */
export function StoreProvider({ value, live, children }: { value: TenantBundle; live?: boolean; children: ReactNode }) {
  const limited = useMemo(() => value.catalog.products.some((p) => p.variants.some((v) => v.campaign?.left !== undefined)), [value.catalog]);
  const [fresh, setFresh] = useState<Campaign[] | null>(null);

  useEffect(() => {
    if (!live || !limited || value.source !== "db") return;
    let alive = true;
    void import("@/lib/db/public")
      .then(({ publicClient }) => publicClient().rpc("store_campaigns", { tenant_slug: value.tenant.slug }))
      .then(({ data, error }) => {
        if (alive && !error && data) setFresh(storeCampaignsFrom(data));
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [live, limited, value.source, value.tenant.slug]);

  const bundle = useMemo(() => (fresh ? { ...value, catalog: withLiveLeft(value.catalog, fresh) } : value), [value, fresh]);
  return <Ctx.Provider value={bundle}>{children}</Ctx.Provider>;
}

export function useStore(): TenantBundle {
  const v = useContext(Ctx);
  if (!v) throw new Error("useStore fuera de StoreProvider");
  return v;
}
