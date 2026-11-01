"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePersisted, type Doc } from "./storage";

export type DocStatus = "live" | "dirty" | "saved";

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/**
 * Documento editable con borrador y versión publicada (Apariencia, Textos, SEO).
 * - `value`: lo que se está editando (cambios locales > borrador guardado > publicado > base del tenant).
 * - `published`: lo que ven los clientes.
 */
export function useDoc<T>(key: string, base: T) {
  const [doc, setDoc, hydrated] = usePersisted<Doc<T>>(key, { draft: null, published: null });
  const [local, setLocal] = useState<T | null>(null);

  const published = doc.published ?? base;
  const saved = doc.draft ?? published;
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

  const saveDraft = useCallback(() => {
    setDoc((d) => ({ ...d, draft: value, savedAt: new Date().toISOString() }));
    setLocal(null);
  }, [setDoc, value]);

  const publish = useCallback(() => {
    setDoc((d) => ({ ...d, draft: null, published: value, publishedAt: new Date().toISOString() }));
    setLocal(null);
  }, [setDoc, value]);

  /** Descarta borrador y cambios locales: vuelve a lo publicado. */
  const discard = useCallback(() => {
    setDoc((d) => ({ ...d, draft: null }));
    setLocal(null);
  }, [setDoc]);

  const isBase = useMemo(() => same(value, base), [value, base]);

  return { value, published, edit, saveDraft, publish, discard, status, dirty, hydrated, isBase, publishedAt: doc.publishedAt, hasPublished: doc.published !== null };
}

export const STATUS_LABEL: Record<DocStatus, [string, string]> = {
  live: ["Publicada", "publicado"],
  dirty: ["Cambios sin publicar", "pend"],
  saved: ["Borrador guardado", "borrador"],
};
