"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { asset } from "@/lib/assets";
import { isLocal, normFrame, type FormatId, type Frame, type MediaItem, type MediaMap } from "@/lib/media";
import { dataKey, usePersisted } from "@/lib/admin/storage";
import { cachedLocalUrl, deleteBlob, forgetLocalUrl, loadLocalUrl, prepareImage, putBlob, rememberLocalUrl } from "@/lib/admin/mediaStore";
import { MediaProvider } from "@/components/Photo";
import { refreshStore } from "@/app/admin/actions";
import { useDb } from "./DbContext";
import { useAdmin } from "./AdminContext";

type Ctx = {
  /** Todas las fotos de la marca: las de Instagram y las subidas, con su encuadre. */
  media: MediaMap;
  list: MediaItem[];
  resolve: (src: string) => string | undefined;
  upload: (files: FileList | File[]) => Promise<{ added: string[]; errors: string[] }>;
  setFrame: (src: string, format: FormatId, frame: Frame) => Promise<void>;
  setSize: (src: string, width: number, height: number) => void;
  remove: (src: string) => void;
};

const MediaCtx = createContext<Ctx | null>(null);

/** Busca rutas de fotos de la marca ("img/…") en cualquier JSON. */
function collectIg(...sources: unknown[]): string[] {
  const out = new Set<string>();
  const walk = (v: unknown) => {
    if (typeof v === "string" && /^img\/.+\.(jpe?g|png|webp)$/i.test(v) && !/logo\./.test(v)) out.add(v);
    else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === "object") Object.values(v).forEach(walk);
  };
  sources.forEach(walk);
  return [...out];
}

const uid = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`);

type Row = { id: string; src: string; origin: "ig" | "upload"; ig_media_id: string | null; width: number | null; height: number | null; alt: string; frames: MediaItem["frames"]; created_at: string };

const fromRow = (r: Row): MediaItem => ({
  id: r.id, src: r.src, origin: r.origin, ...(r.ig_media_id ? { igMediaId: r.ig_media_id } : {}),
  ...(r.width ? { width: r.width } : {}), ...(r.height ? { height: r.height } : {}),
  alt: r.alt, frames: r.frames ?? {}, createdAt: r.created_at,
});

/** Ruta dentro del bucket a partir de la URL pública (para borrar el archivo). */
const storagePath = (url: string) => url.split("/storage/v1/object/public/media/")[1];

/**
 * Fotos de la marca en el admin.
 * - Demo (sin Supabase): metadatos en localStorage y archivos en IndexedDB.
 * - Con Supabase: tabla `media` y bucket `media` (la tienda las ve al instante).
 */
export function AdminMediaProvider({ children }: { children: ReactNode }) {
  const { bundle, demo } = useAdmin();
  const extra = demo.igPosts;
  const slug = bundle.tenant.slug;
  const db = useDb();
  const ready = db?.state.phase === "ready" ? db.state : null;
  const [local, setLocal] = usePersisted<MediaMap>(dataKey(slug, "media"), {});
  const [rows, setRows] = useState<MediaMap>({});
  const saved = ready ? rows : local;
  const [tick, setTick] = useState(0);
  /** Tamaño real de las fotos que no lo tienen guardado (p. ej. las de Instagram), medido en el navegador. */
  const [sizes, setSizes] = useState<Record<string, { width: number; height: number }>>({});

  const client = db?.client;
  const tenantId = ready?.tenantId;
  useEffect(() => {
    if (!client || !tenantId) return;
    let alive = true;
    client.from("media").select("id, src, origin, ig_media_id, width, height, alt, frames, created_at").eq("tenant_id", tenantId)
      .then(({ data }) => alive && setRows(Object.fromEntries(((data ?? []) as Row[]).map((r) => [r.src, fromRow(r)]))));
    return () => {
      alive = false;
    };
  }, [client, tenantId]);

  /** Guarda un cambio de una foto (en la base o en el navegador). */
  const write = useCallback(
    async (src: string, item: MediaItem | null) => {
      if (!ready || !client) {
        setLocal((prev) => {
          const next = { ...prev };
          if (item) next[src] = item;
          else delete next[src];
          return next;
        });
        return;
      }
      if (!item) {
        const cur = rows[src];
        if (cur?.id) await client.from("media").delete().eq("id", cur.id);
        const path = storagePath(src);
        if (path) await client.storage.from("media").remove([path]);
        setRows((prev) => {
          const next = { ...prev };
          delete next[src];
          return next;
        });
      } else {
        const body = { tenant_id: ready.tenantId, src, origin: item.origin, ig_media_id: item.igMediaId ?? null, width: item.width ?? null, height: item.height ?? null, alt: item.alt ?? "", frames: item.frames ?? {} };
        const q = item.id ? client.from("media").update(body).eq("id", item.id).select().single() : client.from("media").insert(body).select().single();
        const { data, error } = await q;
        if (error) throw new Error(error.message);
        setRows((prev) => ({ ...prev, [src]: fromRow(data as Row) }));
      }
      await refreshStore();
    },
    [ready, client, rows, setLocal],
  );

  const media = useMemo<MediaMap>(() => {
    const out: MediaMap = { ...(bundle.media ?? {}) };
    for (const src of collectIg(bundle.catalog, bundle.storefront, extra)) out[src] = out[src] ?? { src, origin: "ig" };
    for (const [src, it] of Object.entries(saved)) out[src] = { ...out[src], ...it };
    for (const [src, sz] of Object.entries(sizes)) if (out[src] && !out[src].width) out[src] = { ...out[src], ...sz };
    return out;
  }, [bundle, extra, saved, sizes]);

  const list = useMemo(
    () => Object.values(media).sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? "") || a.src.localeCompare(b.src)),
    [media],
  );

  // Carga las fotos subidas (IndexedDB) y vuelve a pintar cuando están listas.
  useEffect(() => {
    let alive = true;
    const missing = Object.keys(saved).filter((s) => isLocal(s) && !cachedLocalUrl(s));
    if (missing.length) Promise.all(missing.map(loadLocalUrl)).then(() => alive && setTick((t) => t + 1));
    return () => {
      alive = false;
    };
  }, [saved]);

  // `tick` cambia cuando terminan de cargar fotos locales: así las pantallas vuelven a pedir la URL.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const resolve = useCallback((src: string) => (isLocal(src) ? cachedLocalUrl(src) : asset(slug, src)), [slug, tick]);

  const patch = useCallback(
    (src: string, p: Partial<MediaItem>) => write(src, { ...(media[src] ?? { src, origin: "ig" }), ...saved[src], ...p }),
    [write, saved, media],
  );

  const upload = useCallback(
    async (files: FileList | File[]) => {
      const added: string[] = [];
      const errors: string[] = [];
      for (const file of Array.from(files)) {
        try {
          const { blob, width, height } = await prepareImage(file);
          const id = uid();
          let src = `local:${id}`;
          if (ready && client) {
            const path = `${slug}/${id}.jpg`;
            const { error } = await client.storage.from("media").upload(path, blob, { contentType: "image/jpeg", cacheControl: "31536000" });
            if (error) throw new Error(`no se pudo subir (${error.message})`);
            src = client.storage.from("media").getPublicUrl(path).data.publicUrl;
          } else {
            await putBlob(id, blob);
            rememberLocalUrl(src, blob);
          }
          await write(src, { src, origin: "upload", width, height, name: file.name, createdAt: new Date().toISOString() });
          added.push(src);
        } catch (e) {
          errors.push(`${file.name}: ${e instanceof Error ? e.message : "no se pudo subir"}`);
        }
      }
      return { added, errors };
    },
    [ready, client, slug, write],
  );

  const setFrame = useCallback(
    (src: string, format: FormatId, frame: Frame) => patch(src, { frames: { ...(media[src]?.frames ?? {}), [format]: normFrame(frame) } }),
    [patch, media],
  );

  const setSize = useCallback((src: string, width: number, height: number) => {
    setSizes((prev) => (prev[src]?.width === width && prev[src]?.height === height ? prev : { ...prev, [src]: { width, height } }));
  }, []);

  const remove = useCallback(
    (src: string) => {
      void write(src, null);
      if (isLocal(src)) {
        forgetLocalUrl(src);
        deleteBlob(src.slice("local:".length)).catch(() => {});
      }
    },
    [write],
  );

  const value = useMemo<Ctx>(() => ({ media, list, resolve, upload, setFrame, setSize, remove }), [media, list, resolve, upload, setFrame, setSize, remove]);

  return (
    <MediaCtx.Provider value={value}>
      <MediaProvider media={media} resolve={resolve}>
        {children}
      </MediaProvider>
    </MediaCtx.Provider>
  );
}

export function useAdminMedia(): Ctx {
  const v = useContext(MediaCtx);
  if (!v) throw new Error("useAdminMedia fuera de AdminMediaProvider");
  return v;
}

/** Mide la foto si no sabemos su tamaño (para avisar cuando es muy chica para el formato). */
export function useMeasure(src: string | undefined) {
  const { media, resolve, setSize } = useAdminMedia();
  const known = src ? media[src]?.width : 1;
  const url = src ? resolve(src) : undefined;
  useEffect(() => {
    if (!src || known || !url) return;
    const img = new Image();
    img.onload = () => setSize(src, img.naturalWidth, img.naturalHeight);
    img.src = url;
  }, [src, known, url, setSize]);
}
