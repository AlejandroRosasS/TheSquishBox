/**
 * Lee el caption de un post y sugiere nombre, precio, opciones y línea.
 * Todo es sugerencia: el equipo lo revisa en "Convertir en producto".
 * Regla: nunca se inventa un precio. Si el caption no lo dice, el precio queda vacío.
 */

export type SuggestedVariant = { label: string; price: number | null };

export type CaptionSuggestion = {
  name: string;
  /** Precio único si el caption trae uno solo. */
  price: number | null;
  /** 2+ opciones = producto "Con opciones"; vacío = precio único. */
  variants: SuggestedVariant[];
  /** id de la línea sugerida (de las líneas que se le pasan), o null. */
  line: string | null;
  /** "new" = parece un producto; "content" = parece contenido (tips, sorteos, modelos). */
  kind: "new" | "content";
  hashtags: string[];
};

type Line = { id: string; name: string };

// S/ 18 · S/.18 · s/18.90 · S/ 1,200 · 18 soles · 18.50 soles
const PRICE_RE = /(?:\bS\/\.?\s*(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{1,2})?|\d+(?:[.,]\d{1,2})?))|(?:\b(\d+(?:[.,]\d{1,2})?)\s*soles?\b)/gi;
const EMOJI_RE = /[\p{Extended_Pictographic}\u{FE0F}\u{200D}\u{20E3}]/gu;
const BULLET_RE = /^[\s•·\-–—*>✓✔➡️→▪︎◦]+/u;
const CONTENT_WORDS = ["sorteo", "giveaway", "concurso", "tips", "tip ", "consejo", "tutorial", "gracias", "ganador", "ganadora", "te puede tocar", "modelos"];
const SALE_WORDS = ["precio", "disponible", "pedido", "pídelo", "pidelo", "stock", "llegó", "llego", "nuevo", "nueva", "venta", "envío", "envio", "delivery", "s/"];

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

/** "1,200" → 1200 · "18,50" → 18.5 · "18.90" → 18.9 */
export function parseAmount(raw: string): number | null {
  let s = raw.trim();
  if (/^\d{1,3}([.,]\d{3})+$/.test(s)) s = s.replace(/[.,]/g, "");
  else s = s.replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) && n > 0 && n < 100000 ? Math.round(n * 100) / 100 : null;
}

function pricesIn(text: string): number[] {
  const out: number[] = [];
  for (const m of text.matchAll(PRICE_RE)) {
    const n = parseAmount(m[1] ?? m[2] ?? "");
    if (n !== null) out.push(n);
  }
  return out;
}

function clean(text: string): string {
  return text
    .replace(EMOJI_RE, "")
    .replace(/#[\p{L}\p{N}_]+/gu, "")
    .replace(/@[\w.]+/g, "")
    .replace(BULLET_RE, "")
    .replace(/\s+/g, " ")
    .trim();
}

function shorten(s: string, max = 60): string {
  if (s.length <= max) return s;
  const cut = s.slice(0, max);
  const sp = cut.lastIndexOf(" ");
  return (sp > 20 ? cut.slice(0, sp) : cut).replace(/[\s,;:.-]+$/, "");
}

/** Etiqueta de la opción: la línea sin el precio ni separadores ("2 squishies: S/ 18" → "2 squishies"). */
function variantLabel(line: string): string {
  const s = clean(line.replace(PRICE_RE, " "))
    .replace(/\b(a|por|en|precio|solo|sólo)\s*$/i, "")
    .replace(/^(con|de)\s+/i, "")
    .replace(/[\s:=|,;.\-–—(]+$/g, "")
    .replace(/^[\s:=|,;.\-–—)]+/g, "")
    .trim();
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : "";
}

/** Nombre: la primera frase con letras, sin emojis ni hashtags. */
function suggestName(caption: string): string {
  for (const raw of caption.split(/\n+/)) {
    const line = clean(raw.replace(PRICE_RE, " "));
    if (!/\p{L}{3,}/u.test(line)) continue;
    const first = line.split(/(?<=[.!?¡¿])\s+|\s[|–—]\s/)[0].replace(/^[¡¿]+|[.!?]+$/g, "").trim();
    return shorten(first || line);
  }
  return "";
}

/** "con 2 o 3 squishies" → ["2 squishies", "3 squishies"] (sin precio). */
function countOptions(text: string): string[] {
  const m = /\b(\d{1,2})\s*(?:,\s*\d{1,2}\s*)*(?:o|ó|y|u|\/)\s*(\d{1,2})\s+([\p{L}]{3,})/iu.exec(text);
  if (!m) return [];
  const nums = m[0].match(/\d{1,2}/g) ?? [];
  const noun = m[3];
  return [...new Set(nums)].map((n) => `${n} ${noun}`);
}

function suggestLine(text: string, lines: Line[]): string | null {
  const t = norm(text);
  let best: { id: string; len: number } | null = null;
  for (const l of lines) {
    const n = norm(l.name).trim();
    if (n.length < 3) continue;
    // "Cajas Mystery" coincide si aparece "mystery"; se queda la coincidencia más larga.
    const words = n.split(/\s+/).filter((w) => w.length >= 4);
    // "cumple" en el caption también cuenta para la línea "Cumpleaños".
    const textWords = t.split(/[^a-z0-9]+/).filter((w) => w.length >= 5);
    const hitWord = (w: string) => t.includes(w) || textWords.some((x) => w.startsWith(x));
    const hit = t.includes(n) ? n.length : Math.max(0, ...words.filter(hitWord).map((w) => w.length));
    if (hit && (!best || hit > best.len)) best = { id: l.id, len: hit };
  }
  return best?.id ?? null;
}

export function parseCaption(caption: string | null | undefined, lines: Line[] = []): CaptionSuggestion {
  const text = (caption ?? "").replace(/\r/g, "");
  const hashtags = [...new Set([...text.matchAll(/#([\p{L}\p{N}_]+)/gu)].map((m) => m[1].toLowerCase()))];

  // Opciones con precio: una por línea ("• 2 squishies S/ 18").
  const priced = text
    .split(/\n+/)
    .map((l) => ({ l, prices: pricesIn(l) }))
    .filter((x) => x.prices.length === 1);
  let variants: SuggestedVariant[] = priced
    .map((x) => ({ label: variantLabel(x.l), price: x.prices[0] }))
    .filter((v) => v.label && /\p{L}/u.test(v.label));

  const all = pricesIn(text);
  let price: number | null = null;
  if (variants.length < 2) {
    variants = [];
    // Un solo precio (o varios iguales) = precio único. Precios distintos sin etiqueta: no se adivina.
    if (all.length && all.every((p) => p === all[0])) price = all[0];
    // Opciones sin precio: "con 2 o 3 squishies".
    const opts = countOptions(text);
    if (opts.length >= 2) {
      variants = opts.map((label) => ({ label, price: null }));
      price = null;
    }
  }

  const t = norm(text);
  const looksSale = all.length > 0 || variants.length > 0 || SALE_WORDS.some((w) => t.includes(norm(w)));
  const looksContent = CONTENT_WORDS.some((w) => t.includes(norm(w)));
  const kind = looksSale && !(looksContent && all.length === 0) ? "new" : "content";

  return { name: suggestName(text), price, variants, line: suggestLine(text, lines), kind, hashtags };
}
