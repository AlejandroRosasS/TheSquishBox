"use client";

import { useMemo } from "react";
import type { Storefront } from "@/lib/types";
import { useStoredDoc } from "@/lib/admin/useStoredDoc";
import { useAdmin } from "../AdminContext";
import { withDefaults } from "@/lib/defaults";

/** Bundle de la marca con los textos en borrador (o publicados) aplicados, para las vistas previas. */
export function useTextsDraft() {
  const { bundle } = useAdmin();
  const [doc] = useStoredDoc<Storefront>("texts");
  // Lo guardado manda; los archivos completan las claves que el código agregó después (p. ej. páginas legales).
  const saved = doc.draft ?? doc.published;
  const storefront = saved ? withDefaults(bundle.storefront, saved) : bundle.storefront;
  return useMemo(() => ({ bundle: { ...bundle, storefront }, hasDraft: !!doc.draft }), [bundle, storefront, doc.draft]);
}
