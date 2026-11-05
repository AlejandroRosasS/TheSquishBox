/**
 * Ventas manuales en CSV: el mismo formato para exportar, importar (admin y bot de Telegram) y la plantilla.
 * Una fila por producto vendido; las filas con la misma `venta` (y fecha) son una sola venta.
 * Sin dependencias ni alias para poder probarlo con `npm test`.
 */

export const SALES_COLUMNS = [
  "fecha",
  "venta",
  "canal",
  "cliente",
  "pago",
  "producto",
  "opcion",
  "cantidad",
  "precio",
  "campana",
  "delivery_cobrado",
  "delivery_costo",
  "nota",
] as const;
type Col = (typeof SALES_COLUMNS)[number];

/** Canales de ventas manuales (las de la web se registran solas con cada pedido). */
export const MANUAL_CHANNELS: [string, string][] = [["ig", "Instagram"], ["feria", "Ferias"], ["otros", "Otros"]];
export const PAY_METHODS = ["Yape", "Plin", "Efectivo", "Transferencia", "Tarjeta (POS)"];

export type SaleLineDraft = { productId: string; variantId: string; qty: number; price: number; campaignId?: string; campaign?: string; listPrice?: number };
export type SaleDraft = { ref: string; day: string; channel: string; client: string; pay: string; lines: SaleLineDraft[]; dIn: number; dOut: number; note: string; rows: number[] };

export type CatalogLite = { products: { id: string; name: string; variants: { id: string; label: string; price: number }[] }[] };
/**
 * Precio de una opción en un día (YYYY-MM-DD): el de la campaña vigente ese día o el regular.
 * `campaignName`, si viene, pide esa campaña en particular (si no existe o no tiene esa opción, se ignora).
 */
export type Pricer = (productId: string, variantId: string, day: string, campaignName?: string) => { price: number; campaignId?: string; campaign?: string; listPrice?: number };

export type Issue = { row: number; message: string };
export type ReadResult = { sales: SaleDraft[]; errors: Issue[]; warnings: Issue[] };

// ───────────── CSV ─────────────

/** Normaliza para comparar: minúsculas, sin tildes, espacios simples. */
export const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[\s_\-]+/g, " ")
    .trim();

/** Lee CSV (RFC 4180) con separador «,», «;» o tabulación, detectado en la primera línea. */
export function parseCsv(text: string): string[][] {
  const clean = text
    .replace(/^﻿/, "")
    // Lo que copian de un chat de IA suele venir dentro de ```csv … ```
    .split(/\r?\n/)
    .filter((l) => !/^\s*```/.test(l))
    .join("\n");
  const first = clean.split("\n").find((l) => l.trim()) ?? "";
  const count = (ch: string) => first.split(ch).length - 1;
  const sep = [";", "\t", ","].reduce((a, b) => (count(b) > count(a) ? b : a), ",");
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < clean.length; i++) {
    const c = clean[i];
    if (quoted) {
      if (c === '"') {
        if (clean[i + 1] === '"') {
          cell += '"';
          i++;
        } else quoted = false;
      } else cell += c;
    } else if (c === '"' && cell.trim() === "") {
      quoted = true;
      cell = "";
    } else if (c === sep) {
      row.push(cell);
      cell = "";
    } else if (c === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else if (c !== "\r") cell += c;
  }
  row.push(cell);
  rows.push(row);
  return rows.map((r) => r.map((x) => x.trim())).filter((r) => r.some((x) => x !== ""));
}

const esc = (v: string | number) => {
  const s = String(v);
  return /[",\n\r;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
export const toCsv = (rows: (string | number)[][]) => rows.map((r) => r.map(esc).join(",")).join("\r\n") + "\r\n";

// ───────────── Valores ─────────────

/** "S/ 1,240.50", "69", "18,50" → número (null si está vacío o no es un monto). */
export function parseMoney(raw: string): number | null {
  let s = raw.replace(/s\/\.?|soles?|pen/gi, "").replace(/\s/g, "");
  if (!s) return null;
  if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) s = s.replace(/,/g, "");
  else if (/^\d+,\d{1,2}$/.test(s)) s = s.replace(",", ".");
  if (!/^\d+(\.\d+)?$/.test(s)) return null;
  return Math.round(parseFloat(s) * 100) / 100;
}

/** "2026-11-05", "05/11/2026", "5/11/26", "5-11-2026" → "2026-11-05" (null si no es una fecha válida). */
export function parseDay(raw: string): string | null {
  const s = raw.trim().split(/[ T]/)[0];
  let y: number, m: number, d: number;
  let r = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/.exec(s);
  if (r) [y, m, d] = [+r[1], +r[2], +r[3]];
  else if ((r = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2}|\d{4})$/.exec(s))) [d, m, y] = [+r[1], +r[2], r[3].length === 2 ? 2000 + +r[3] : +r[3]];
  else return null;
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

const CHANNEL_WORDS: [string, string[]][] = [
  ["ig", ["ig", "instagram", "insta", "dm", "whatsapp", "wsp", "redes", "tiktok", "facebook"]],
  ["feria", ["feria", "ferias", "evento", "eventos", "bazar", "stand"]],
  ["otros", ["otros", "otro", "colegio", "colegios", "referido", "referidos", "empresa", "empresas", "tienda fisica"]],
];
export function parseChannel(raw: string): string | "web" | null {
  const n = norm(raw);
  if (!n) return null;
  if (n === "web" || n === "tienda web" || n === "pagina web") return "web";
  return CHANNEL_WORDS.find(([, words]) => words.includes(n))?.[0] ?? null;
}

export function parsePay(raw: string): string {
  const n = norm(raw);
  if (!n) return "";
  if (n.includes("tarjeta") || n === "pos" || n.includes("visa")) return "Tarjeta (POS)";
  if (n.includes("transfer") || n.includes("deposito")) return "Transferencia";
  return PAY_METHODS.find((p) => norm(p) === n) ?? raw.trim();
}

const HEADER_ALIASES: Record<string, Col> = {
  fecha: "fecha", dia: "fecha", "fecha de venta": "fecha",
  venta: "venta", "n venta": "venta", "venta id": "venta", id: "venta", pedido: "venta",
  canal: "canal",
  cliente: "cliente", "nombre cliente": "cliente",
  pago: "pago", "medio de pago": "pago", "metodo de pago": "pago",
  producto: "producto", "producto id": "producto",
  opcion: "opcion", variante: "opcion", "opcion id": "opcion",
  cantidad: "cantidad", unidades: "cantidad", cant: "cantidad",
  precio: "precio", "precio unitario": "precio", "precio cobrado": "precio",
  campana: "campana", "campana de oferta": "campana",
  "delivery cobrado": "delivery_cobrado", delivery: "delivery_cobrado",
  "delivery costo": "delivery_costo", "costo delivery": "delivery_costo", "delivery costo real": "delivery_costo",
  nota: "nota", notas: "nota", comentario: "nota",
};

// ───────────── Catálogo ─────────────

function findProduct(catalog: CatalogLite, raw: string) {
  const n = norm(raw);
  const ps = catalog.products;
  const exact = ps.find((p) => p.id === raw.trim() || norm(p.id) === n || norm(p.name) === n);
  if (exact) return { product: exact };
  const partial = ps.filter((p) => norm(p.name).includes(n) || n.includes(norm(p.name)));
  if (partial.length === 1) return { product: partial[0] };
  return { error: partial.length ? `«${raw}» puede ser ${partial.map((p) => p.name).join(" o ")}` : `No encuentro el producto «${raw}»` };
}

function findVariant(p: CatalogLite["products"][number], raw: string) {
  if (!raw.trim()) return p.variants.length === 1 ? { variant: p.variants[0] } : { error: `Falta la opción de ${p.name} (${p.variants.map((v) => v.label).join(", ")})` };
  const n = norm(raw);
  const v = p.variants.find((x) => x.id === raw.trim() || norm(x.id) === n || norm(x.label) === n) ?? (() => {
    const partial = p.variants.filter((x) => norm(x.label).includes(n) || n.includes(norm(x.label)));
    return partial.length === 1 ? partial[0] : undefined;
  })();
  return v ? { variant: v } : { error: `${p.name} no tiene la opción «${raw}» (tiene ${p.variants.map((x) => x.label).join(", ")})` };
}

// ───────────── Importar ─────────────

/** Huella corta (FNV-1a) para reconocer una venta ya cargada. */
export function fingerprint(s: string): string {
  let h1 = 0x811c9dc5, h2 = 0x01000193;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 16777619);
    h2 = Math.imul(h2 ^ c, 2246822519);
  }
  return ((h1 >>> 0).toString(36) + (h2 >>> 0).toString(36)).slice(0, 12);
}

/**
 * CSV → ventas listas para guardar. Las filas con error no se cargan; el resto sí.
 * `today` (YYYY-MM-DD, hora de Perú) evita fechas futuras.
 */
export function readSalesCsv(text: string, opts: { catalog: CatalogLite; price: Pricer; today: string }): ReadResult {
  const rows = parseCsv(text);
  const errors: Issue[] = [];
  const warnings: Issue[] = [];
  if (!rows.length) return { sales: [], errors: [{ row: 0, message: "El archivo está vacío" }], warnings };

  const header = rows[0].map((h) => HEADER_ALIASES[norm(h)]);
  const missing = (["fecha", "producto", "cantidad"] as Col[]).filter((c) => !header.includes(c));
  if (missing.length) {
    return { sales: [], errors: [{ row: 1, message: `Faltan las columnas ${missing.join(", ")}. La primera fila debe ser: ${SALES_COLUMNS.join(",")}` }], warnings };
  }
  const at = (r: string[], c: Col) => {
    const i = header.indexOf(c);
    return i < 0 ? "" : (r[i] ?? "").trim();
  };

  type Parsed = { n: number; day: string; group: string; channel: string; client: string; pay: string; line: SaleLineDraft; dIn: number | null; dOut: number | null; note: string };
  const parsed: Parsed[] = [];
  rows.slice(1).forEach((r, i) => {
    const n = i + 2; // número de fila como en Excel (la 1 es la cabecera)
    const fail = (message: string) => errors.push({ row: n, message });
    const day = parseDay(at(r, "fecha"));
    if (!day) return fail(`Fecha «${at(r, "fecha")}» no válida (usa AAAA-MM-DD, por ejemplo ${opts.today})`);
    if (day > opts.today) return fail(`La fecha ${day} todavía no llega`);
    const group = at(r, "venta");
    if (/^web-/i.test(group)) return warnings.push({ row: n, message: "Venta de la web: ya está registrada, no se vuelve a cargar" });
    const rawCh = at(r, "canal");
    let channel = parseChannel(rawCh);
    if (channel === "web") return fail("Las ventas de la web se registran solas; usa Instagram, Ferias u Otros");
    if (!channel) {
      if (rawCh) return fail(`Canal «${rawCh}» no válido (usa ig, feria u otros)`);
      channel = "otros";
      warnings.push({ row: n, message: "Sin canal: se registra como Otros" });
    }
    const fp = findProduct(opts.catalog, at(r, "producto"));
    if (!at(r, "producto")) return fail("Falta el producto");
    if ("error" in fp) return fail(fp.error!);
    const fv = findVariant(fp.product, at(r, "opcion"));
    if ("error" in fv) return fail(fv.error!);
    const rawQty = at(r, "cantidad") || "1";
    const qty = /^\d+$/.test(rawQty) ? parseInt(rawQty, 10) : NaN;
    if (!(qty >= 1 && qty <= 999)) return fail(`Cantidad «${rawQty}» no válida`);
    const rawPrice = at(r, "precio");
    const charged = rawPrice ? parseMoney(rawPrice) : null;
    if (rawPrice && charged === null) return fail(`Precio «${rawPrice}» no válido`);
    const day0 = opts.price(fp.product.id, fv.variant.id, day, at(r, "campana") || undefined);
    let line: SaleLineDraft;
    if (charged === null || charged === day0.price) line = { productId: fp.product.id, variantId: fv.variant.id, qty, ...day0 };
    else {
      // Precio distinto al del día: se respeta lo cobrado y no se cuenta como campaña.
      line = { productId: fp.product.id, variantId: fv.variant.id, qty, price: charged };
      if (at(r, "campana")) warnings.push({ row: n, message: `El precio ${charged} no es el de la campaña «${at(r, "campana")}» ese día: se registra sin campaña` });
    }
    const money = (c: Col) => {
      const raw = at(r, c);
      if (!raw) return null;
      const v = parseMoney(raw);
      if (v === null) warnings.push({ row: n, message: `${c.replace("_", " ")} «${raw}» no es un monto: se deja en 0` });
      return v;
    };
    parsed.push({ n, day, group, channel, client: at(r, "cliente"), pay: parsePay(at(r, "pago")), line, dIn: money("delivery_cobrado"), dOut: money("delivery_costo"), note: at(r, "nota") });
  });

  // Agrupar: misma `venta` y misma fecha = una venta. Sin `venta`, cada fila es una venta.
  const groups = new Map<string, Parsed[]>();
  for (const p of parsed) {
    const key = p.group ? `${p.day}|${p.group}` : `${p.day}|fila${p.n}`;
    groups.set(key, [...(groups.get(key) ?? []), p]);
  }
  const sales: SaleDraft[] = [...groups.entries()].map(([key, ps]) => {
    const f = ps[0];
    const pick = <T,>(get: (p: Parsed) => T | null | "") => ps.map(get).find((v) => v !== null && v !== "") ?? null;
    const lines = ps.map((p) => p.line);
    const sale = {
      day: f.day,
      channel: f.channel,
      client: (pick((p) => p.client) as string | null) ?? "",
      pay: (pick((p) => p.pay) as string | null) ?? "",
      lines,
      dIn: (pick((p) => p.dIn) as number | null) ?? 0,
      dOut: (pick((p) => p.dOut) as number | null) ?? 0,
      note: [...new Set(ps.map((p) => p.note).filter(Boolean))].join(" · "),
    };
    // Si `venta` ya es una referencia nuestra (viene de un export), se respeta para no duplicar.
    const ref = /^m[0-9a-z]{8,}$/.test(f.group) ? f.group : `m${fingerprint(`${key}|${JSON.stringify(sale)}`)}`;
    return { ref, ...sale, rows: ps.map((p) => p.n) };
  });
  return { sales, errors, warnings };
}

// ───────────── Exportar ─────────────

export type ExportSale = { ref: string; day: string; channel: string; client: string; pay: string; lines: (SaleLineDraft & { name?: string; variantLabel?: string })[]; dIn: number; dOut: number; note: string };

export function salesToCsv(sales: ExportSale[], catalog: CatalogLite): string {
  const out: (string | number)[][] = [[...SALES_COLUMNS]];
  for (const s of sales) {
    s.lines.forEach((l, i) => {
      const p = catalog.products.find((x) => x.id === l.productId);
      const v = p?.variants.find((x) => x.id === l.variantId);
      out.push([
        s.day, s.ref, s.channel, s.client, s.pay,
        p?.id ?? l.productId, v?.label ?? l.variantLabel ?? l.variantId, l.qty, l.price.toFixed(2), l.campaign ?? "",
        i ? "" : s.dIn ? s.dIn.toFixed(2) : "", i ? "" : s.dOut ? s.dOut.toFixed(2) : "", i ? "" : s.note,
      ]);
    });
  }
  return toCsv(out);
}

/** Plantilla con dos ventas de ejemplo usando productos reales del catálogo. */
export function templateCsv(catalog: CatalogLite, today: string): string {
  const [a, b] = catalog.products;
  const out: (string | number)[][] = [[...SALES_COLUMNS]];
  if (a) out.push([today, "1", "ig", "María P.", "Yape", a.id, a.variants[0]?.label ?? "", 1, "", "", "10.00", "8.00", "Entrega en Miraflores"]);
  if (b) out.push([today, "2", "feria", "", "Efectivo", b.id, b.variants[0]?.label ?? "", 2, "", "", "", "", ""]);
  if (a) out.push([today, "2", "feria", "", "Efectivo", a.id, a.variants[0]?.label ?? "", 1, "", "", "", "", ""]);
  return toCsv(out);
}
