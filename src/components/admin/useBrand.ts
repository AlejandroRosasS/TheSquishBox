"use client";

import { useMemo } from "react";
import { useStoredDoc } from "@/lib/admin/useStoredDoc";
import { withBrand, type AppearanceDoc } from "@/lib/brand";
import type { Tenant } from "@/lib/types";
import { useAdmin } from "./AdminContext";
import { useAdminMedia } from "./AdminMedia";

/**
 * Marca con el nombre y logo PUBLICADOS en Apariencia, para la cabecera del panel.
 * Con Supabase el servidor ya los aplica; esto cubre la demo y el rato antes de recargar.
 */
export function useBrandTenant(): { tenant: Tenant; resolve: (src: string) => string | undefined } {
  const { bundle } = useAdmin();
  const { resolve } = useAdminMedia();
  const [doc] = useStoredDoc<AppearanceDoc>("appearance");
  const brand = doc.published?.brand;
  const tenant = useMemo(() => withBrand(bundle.tenant, brand), [bundle.tenant, brand]);
  return { tenant, resolve };
}
