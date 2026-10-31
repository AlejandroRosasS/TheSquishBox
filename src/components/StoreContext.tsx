"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { TenantBundle } from "@/tenants";

const Ctx = createContext<TenantBundle | null>(null);

export function StoreProvider({ value, children }: { value: TenantBundle; children: ReactNode }) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore(): TenantBundle {
  const v = useContext(Ctx);
  if (!v) throw new Error("useStore fuera de StoreProvider");
  return v;
}
