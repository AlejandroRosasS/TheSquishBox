"use client";

import { useMemo } from "react";
import type { Storefront } from "@/lib/types";
import { useStoredDoc } from "@/lib/admin/useStoredDoc";
import { useAdmin } from "../AdminContext";

/** Bundle de la marca con los textos en borrador (o publicados) aplicados, para las vistas previas. */
export function useTextsDraft() {
  const { bundle } = useAdmin();
  const [doc] = useStoredDoc<Storefront>("texts");
  const storefront = doc.draft ?? doc.published ?? bundle.storefront;
  return useMemo(() => ({ bundle: { ...bundle, storefront }, hasDraft: !!doc.draft }), [bundle, storefront, doc.draft]);
}
