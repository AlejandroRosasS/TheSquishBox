/**
 * Fotos de la tienda: de dónde vienen (Instagram o subidas por el equipo) y cómo se encuadran
 * en cada formato. Las referencias a fotos siguen siendo strings ("img/x.jpg", una URL o "local:<id>"
 * en la demo); el encuadre vive aparte, por foto y por formato.
 */

/** Formatos de la tienda (relación de aspecto). */
export type FormatId = "4:5" | "1:1" | "3:4" | "16:9" | "16:10";

export const FORMATS: Record<FormatId, { label: string; w: number; h: number; /** Ancho mínimo recomendado (px) para que no se vea borrosa. */ minW: number }> = {
  "4:5": { label: "Vertical 4:5", w: 4, h: 5, minW: 1080 },
  "1:1": { label: "Cuadrada 1:1", w: 1, h: 1, minW: 600 },
  "3:4": { label: "Vertical 3:4", w: 3, h: 4, minW: 1080 },
  "16:9": { label: "Horizontal 16:9", w: 16, h: 9, minW: 1920 },
  "16:10": { label: "Horizontal 16:10", w: 16, h: 10, minW: 1080 },
};

/** Encuadre: punto de la foto que se mantiene a la vista (0–100 %) y zoom (1 = sin zoom). */
export type Frame = { x: number; y: number; zoom: number };
export const CENTER: Frame = { x: 50, y: 50, zoom: 1 };

export type MediaItem = {
  /** id en la base (Fase 3). */
  id?: string;
  src: string;
  origin: "ig" | "upload";
  igMediaId?: string;
  width?: number;
  height?: number;
  name?: string;
  alt?: string;
  frames?: Partial<Record<FormatId, Frame>>;
  createdAt?: string;
};

/** Fotos conocidas de la marca, por src. */
export type MediaMap = Record<string, MediaItem>;

/**
 * Dónde se usa cada foto y en qué formato. `d` = escritorio, `m` = celular.
 * Cuando ambos formatos son distintos conviene permitir una foto por formato.
 */
export type Slot = { d: FormatId; m: FormatId; label: string };
export const SLOTS = {
  product: { d: "4:5", m: "4:5", label: "Foto de producto" },
  hero: { d: "16:9", m: "3:4", label: "Portada" },
  tiles: { d: "4:5", m: "16:10", label: "Acceso por línea" },
  partyBand: { d: "4:5", m: "4:5", label: "Banda de pedido especial" },
  inside: { d: "4:5", m: "4:5", label: "¿Qué hay dentro?" },
  models: { d: "1:1", m: "1:1", label: "Modelo" },
} satisfies Record<string, Slot>;
export type SlotId = keyof typeof SLOTS;

/** Listas de fotos cuyo nombre no coincide con el formato (models.photos → Modelo). */
const SLOT_ALIAS: Record<string, SlotId> = { photos: "models" };
export const slotFor = (key: string): Slot => (SLOTS as Record<string, Slot>)[SLOT_ALIAS[key] ?? key] ?? SLOTS.product;
export const hasTwoFormats = (s: Slot) => s.d !== s.m;

const clamp = (n: number, a: number, b: number) => Math.min(b, Math.max(a, n));
export function normFrame(f?: Partial<Frame>): Frame {
  return { x: clamp(f?.x ?? 50, 0, 100), y: clamp(f?.y ?? 50, 0, 100), zoom: clamp(f?.zoom ?? 1, 1, 3) };
}

export function frameOf(media: MediaMap | undefined, src: string, format: FormatId): Frame {
  return normFrame(media?.[src]?.frames?.[format]);
}

/** Estilo para un <img> con object-fit: cover dentro de un contenedor con overflow: hidden. */
export function frameStyle(f: Frame): { objectPosition: string; transform?: string; transformOrigin?: string } {
  const pos = `${f.x}% ${f.y}%`;
  return f.zoom > 1 ? { objectPosition: pos, transform: `scale(${f.zoom})`, transformOrigin: pos } : { objectPosition: pos };
}

/** Variables CSS para que la tienda cambie de encuadre según el ancho (ver `img.fr` en store.css). */
export function frameVars(d: Frame, m: Frame): Record<string, string> {
  return {
    "--px": `${d.x}%`, "--py": `${d.y}%`, "--pz": String(d.zoom),
    "--pxm": `${m.x}%`, "--pym": `${m.y}%`, "--pzm": String(m.zoom),
  };
}

/** ¿La foto alcanza para el formato? Devuelve un aviso o null. */
export function sizeWarning(width: number | undefined, format: FormatId, zoom = 1): string | null {
  if (!width) return null;
  const need = FORMATS[format].minW * zoom;
  if (width >= need) return null;
  return `La foto mide ${width} px de ancho y para ${FORMATS[format].label.toLowerCase()} se recomiendan ${Math.round(need)} px o más. Puede verse borrosa en pantallas grandes.`;
}

export const isLocal = (src: string) => src.startsWith("local:");
