"use client";

/**
 * Fotos subidas por el equipo (demo, Fase 2): el archivo se guarda en IndexedDB del navegador y se
 * referencia como "local:<id>". En Fase 3 el mismo archivo (ya redimensionado) va a Supabase Storage,
 * bucket `media`, ruta `<slug>/<uuid>.jpg`, y la referencia pasa a ser su URL pública.
 */

const DB = "tienda-media";
const STORE = "blobs";
const MAX_SIDE = 2400;
export const MAX_FILE_MB = 25;
export const ACCEPT = "image/jpeg,image/png,image/webp";

function open(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE);
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}

async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  return new Promise((res, rej) => {
    const req = fn(db.transaction(STORE, mode).objectStore(STORE));
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  });
}

export const putBlob = (id: string, blob: Blob) => tx("readwrite", (s) => s.put(blob, id));
export const getBlob = (id: string) => tx<Blob | undefined>("readonly", (s) => s.get(id) as IDBRequest<Blob | undefined>);
export const deleteBlob = (id: string) => tx("readwrite", (s) => s.delete(id));

/** Reduce la foto a un máximo de 2400 px por lado y la pasa a JPEG. */
export async function prepareImage(file: File): Promise<{ blob: Blob; width: number; height: number }> {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) throw new Error("Usa una foto JPG, PNG o WebP.");
  if (file.size > MAX_FILE_MB * 1024 * 1024) throw new Error(`La foto pesa más de ${MAX_FILE_MB} MB.`);
  let bmp: ImageBitmap;
  try {
    bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new Error("No pudimos abrir esta foto. Prueba con otra.");
  }
  const k = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height));
  const width = Math.round(bmp.width * k);
  const height = Math.round(bmp.height * k);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Tu navegador no pudo procesar la foto.");
  ctx.fillStyle = "#FFFFFF"; // las PNG con transparencia quedan sobre blanco
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(bmp, 0, 0, width, height);
  bmp.close();
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.86));
  if (!blob) throw new Error("Tu navegador no pudo procesar la foto.");
  return { blob, width, height };
}

/** URLs de objeto ya creadas para fotos locales (se comparten entre pantallas). */
const urls = new Map<string, string>();
const pending = new Map<string, Promise<string | undefined>>();

export const cachedLocalUrl = (src: string) => urls.get(src);

export function loadLocalUrl(src: string): Promise<string | undefined> {
  const hit = urls.get(src);
  if (hit) return Promise.resolve(hit);
  let p = pending.get(src);
  if (!p) {
    p = getBlob(src.slice("local:".length))
      .then((b) => {
        if (!b) return undefined;
        const u = URL.createObjectURL(b);
        urls.set(src, u);
        return u;
      })
      .catch(() => undefined)
      .finally(() => pending.delete(src));
    pending.set(src, p);
  }
  return p;
}

export function rememberLocalUrl(src: string, blob: Blob) {
  urls.set(src, URL.createObjectURL(blob));
}

export function forgetLocalUrl(src: string) {
  const u = urls.get(src);
  if (u) URL.revokeObjectURL(u);
  urls.delete(src);
}
