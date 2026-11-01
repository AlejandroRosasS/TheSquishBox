"use client";

import { useMemo } from "react";
import type { Storefront } from "@/lib/types";
import { docKey, usePersisted, type Doc } from "@/lib/admin/storage";
import { useAdmin } from "../AdminContext";

/** Bundle de la marca con los textos en borrador (o publicados) aplicados, para las vistas previas. */
export function useTextsDraft() {
  const { bundle } = useAdmin();
  const [doc] = usePersisted<Doc<Storefront>>(docKey(bundle.tenant.slug, "texts"), { draft: null, published: null });
  const storefront = doc.draft ?? doc.published ?? bundle.storefront;
  return useMemo(() => ({ bundle: { ...bundle, storefront }, hasDraft: !!doc.draft }), [bundle, storefront, doc.draft]);
}
