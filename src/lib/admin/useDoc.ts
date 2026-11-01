"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAdmin } from "@/components/admin/AdminContext";
import type { DocName } from "@/components/admin/DbContext";
import { useStoredDoc } from "./useStoredDoc";
import { withDefaults } from "@/lib/defaults";

export type DocStatus = "live" | "dirty" | "saved";

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/**
 * Documento editable con borrador y versión publicada (Apariencia, Textos, SEO).
 * - `value`: lo que se está editando (cambios locales > borrador guardado > publicado > base del tenant).
 * - `published`: lo que ven los clientes.
 */
export function useDoc<T>(name: DocName, base: T) {
  const { toast } = useAdmin();
  const [doc, setDoc, hydrated] = useStoredDoc<T>(name);
  const [local, setLocal] = useState<T | null>(null);
  const [busy, setBusy] = useState(false);

  // Lo guardado manda; `base` completa claves que el código agregó después.
  const published = doc.published ? withDefaults(base, doc.published) : base;
  const saved = doc.draft ? withDefaults(base, doc.draft) : published;
  const value = local ?? saved;
  const dirty = local !== null && !same(local, saved);
  const status: DocStatus = dirty ? "dirty" : doc.draft && !same(doc.draft, published) ? "saved" : "live";

  // Avisar antes de salir con cambios sin guardar.
  useEffect(() => {
    if (!dirty) return;
    const onBefore = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", onBefore);
    return () => window.removeEventListener("beforeunload", onBefore);
  }, [dirty]);

  const edit = useCallback((next: T | ((prev: T) => T)) => {
    setLocal((prev) => {
      const cur = prev ?? saved;
      return typeof next === "function" ? (next as (p: T) => T)(cur) : next;
    });
  }, [saved]);

  /** Guarda y devuelve true si salió bien; si falla, avisa y conserva los cambios. */
  const run = useCallback(
    async (next: typeof doc) => {
      setBusy(true);
      try {
        await setDoc(next);
        setLocal(null);
        return true;
      } catch (e) {
        toast(`No se pudo guardar: ${e instanceof Error ? e.message : "error de conexión"}`);
        return false;
      } finally {
        setBusy(false);
      }
    },
    [setDoc, toast],
  );

  const saveDraft = useCallback(() => run({ ...doc, draft: value }), [run, doc, value]);
  const publish = useCallback(() => run({ ...doc, draft: null, published: value }), [run, doc, value]);
  /** Descarta borrador y cambios locales: vuelve a lo publicado. */
  const discard = useCallback(() => (doc.draft ? run({ ...doc, draft: null }) : (setLocal(null), Promise.resolve(true))), [run, doc]);

  const isBase = useMemo(() => same(value, base), [value, base]);

  return { value, published, edit, saveDraft, publish, discard, status, dirty, hydrated, busy, isBase, publishedAt: doc.publishedAt, hasPublished: doc.published !== null };
}

export const STATUS_LABEL: Record<DocStatus, [string, string]> = {
  live: ["Publicada", "publicado"],
  dirty: ["Cambios sin publicar", "pend"],
  saved: ["Borrador guardado", "borrador"],
};
