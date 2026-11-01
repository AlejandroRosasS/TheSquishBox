"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";

/**
 * Persistencia de la demo (Fase 2): todo lo que se edita en el admin se guarda en el navegador.
 * En Fase 3 estas mismas claves pasan a la base de datos (una fila por marca y documento).
 */
const EVENT = "squish-admin-storage";

function subscribe(cb: () => void) {
  const onStorage = () => cb();
  window.addEventListener("storage", onStorage);
  window.addEventListener(EVENT, onStorage);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(EVENT, onStorage);
  };
}

export function readJSON<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function writeJSON(key: string, value: unknown) {
  if (value === null || value === undefined) localStorage.removeItem(key);
  else localStorage.setItem(key, JSON.stringify(value));
  window.dispatchEvent(new Event(EVENT));
}

/** Estado guardado en localStorage y sincronizado entre pestañas. `initial` se usa si no hay nada guardado. */
export function usePersisted<T>(key: string, initial: T): [T, (next: T | ((prev: T) => T)) => void, boolean] {
  const raw = useSyncExternalStore(
    subscribe,
    () => localStorage.getItem(key),
    () => undefined as unknown as string | null,
  );
  const hydrated = raw !== undefined;
  const value = useMemo<T>(() => {
    if (!raw) return initial;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return initial;
    }
    // `initial` suele ser un objeto nuevo en cada render: solo importa el valor guardado.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [raw]);
  const set = useCallback(
    (next: T | ((prev: T) => T)) => {
      const cur = readJSON<T>(key) ?? initial;
      const val = typeof next === "function" ? (next as (p: T) => T)(cur) : next;
      writeJSON(key, val);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key],
  );
  return [value, set, hydrated];
}

/** Documento con borrador y versión publicada (Apariencia, Textos, SEO, Catálogo). */
export type Doc<T> = { draft: T | null; published: T | null; savedAt?: string; publishedAt?: string };

export const docKey = (slug: string, name: "appearance" | "texts" | "seo" | "catalog") => `site:${slug}:${name}`;
export const dataKey = (slug: string, name: string) => `admin:${slug}:${name}`;
