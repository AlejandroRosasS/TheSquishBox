"use client";

import { useCallback } from "react";
import { useAdmin } from "@/components/admin/AdminContext";
import { useDb, type DocName } from "@/components/admin/DbContext";
import { docKey, usePersisted, type Doc } from "./storage";

const EMPTY: Doc<never> = { draft: null, published: null };

/**
 * Documento con borrador y publicado. Con Supabase vive en la base (site_docs);
 * en modo demo, en el navegador. Devuelve [doc, guardar, listo].
 */
export function useStoredDoc<T>(name: DocName): [Doc<T>, (next: Doc<T>) => Promise<void>, boolean] {
  const { bundle } = useAdmin();
  const db = useDb();
  const [local, setLocal, hydrated] = usePersisted<Doc<T>>(docKey(bundle.tenant.slug, name), EMPTY);
  const ready = db?.state.phase === "ready";
  const remote = ready ? ((db.state.phase === "ready" && db.state.docs[name]) as Doc<T> | undefined) : undefined;
  const save = useCallback(
    async (next: Doc<T>) => {
      if (db) await db.setDoc(name, next as Doc<unknown>);
      else setLocal(next);
    },
    [db, name, setLocal],
  );
  if (db) return [remote ?? EMPTY, save, ready];
  return [local, save, hydrated];
}
