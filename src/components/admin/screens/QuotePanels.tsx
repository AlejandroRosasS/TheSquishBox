"use client";

import { useMemo, useState } from "react";
import { formatPrice } from "@/lib/format";
import { newId, qtyLabel, shiftDay, unitsLabel, type Supply, type SupplyState } from "@/lib/inventory";
import {
  QUOTE_STATUS, ROUNDING_LABEL, costOf, quoteSupplies, realMargin, recipeKey, suggestedPrice,
  type CostBreakdown, type PricingRules, type Quote, type QuoteLine, type QuoteStatus, type Recipe, type RecipeLine, type Rounding,
} from "@/lib/pricing";
import { useAdmin, useAdminCatalog } from "../AdminContext";
import { useInventory } from "../AdminInventory";
import { usePaymentFees } from "../AdminFees";
import Link from "next/link";
import { dayLabel } from "../AdminSales";
import { Thumb } from "../PhotoPicker";
import { AIBox, AIClose, AIPlus, AISearch, AITrash, AIUndo, AIWhatsApp } from "../AdminIcons";

const money = (n: number) => formatPrice(Math.round(n * 100) / 100);
const parse = (s: string): number | null => {
  const t = s.replace(",", ".").trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : NaN;
};

/** Datos comunes: insumos por id y su costo promedio de hoy. */
function useCosting(states: Map<string, SupplyState>) {
  const { data } = useInventory();
  const supplies = useMemo(() => new Map(data.supplies.map((s) => [s.id, s])), [data.supplies]);
  const avg = (id: string) => states.get(id)?.avgCost ?? 0;
  const recipe = (product: string, variant: string) => data.recipes.find((r) => recipeKey(r.product, r.variant) === recipeKey(product, variant));
  // La tasa de IGV es la de Ajustes › Comisiones e IGV (la misma que descuenta Ventas y márgenes).
  const { fees } = usePaymentFees();
  const rules = useMemo(() => ({ ...data.pricing, igvRate: fees.igvRate }), [data.pricing, fees.igvRate]);
  return { supplies, avg, recipe, rules };
}

function MarginTag({ price, cost, rules }: { price: number; cost: number; rules: PricingRules }) {
  const m = realMargin(price, cost, rules);
  if (m === null || !cost) return <span className="a-cap">—</span>;
  const target = rules.mode === "margin" ? rules.margin : (1 - 1 / Math.max(rules.multiplier, 1)) * 100;
  return <span className={`st ${m >= target ? "publicado" : m >= 0 ? "bajo" : "cancelado"}`}>{m}%</span>;
}

function Breakdown({ b, title }: { b: CostBreakdown; title?: string }) {
  return (
    <div className="stack g1">
      {title && <b>{title}</b>}
      <div className="q-rows">
        {b.rows.map((r, i) => (
          <div key={i} className="row between g2"><span>{unitsLabel(r.qty, r.unit)} de {r.name}{r.optional ? <span className="a-cap"> ({r.optional})</span> : null}</span><span className="money">{r.unitCost ? money(r.cost) : <span className="st bajo">sin costo</span>}</span></div>
        ))}
        <div className="row between g2 a-cap"><span>Merma esperada</span><span className="money">{money(b.waste)}</span></div>
        {!!b.extra && <div className="row between g2 a-cap"><span>Extras y consumibles</span><span className="money">{money(b.extra)}</span></div>}
        <div className="row between g2"><b>Costo total</b><b className="money">{money(b.total)}</b></div>
      </div>
      {!!b.missing.length && <p className="a-cap">Sin costo todavía (registra una compra): {b.missing.join(", ")}.</p>}
    </div>
  );
}

/* ───────────────────────── Recetas ───────────────────────── */

/** Inventario › Recetas: qué insumos lleva cada opción de producto, su costo y el margen con el precio actual. */
export function RecipesPanel({ states }: { states: Map<string, SupplyState> }) {
  const { catalog } = useAdminCatalog();
  const { supplies, avg, recipe, rules } = useCosting(states);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<{ product: string; variant: string } | null>(null);

  if (open) return <RecipeEditor product={open.product} variant={open.variant} states={states} onDone={() => setOpen(null)} />;

  const rows = catalog.products
    .filter((p) => !q || p.name.toLowerCase().includes(q.toLowerCase()))
    .flatMap((p) => p.variants.map((v) => ({ p, v, r: recipe(p.id, v.id) })));

  return (
    <>
      <p className="a-cap">Con la receta, el costo de cada producto se calcula solo con el costo promedio de sus insumos. El precio de la tienda no cambia: aquí ves el margen real y el precio sugerido.</p>
      <div className="filters-bar"><div className="a-search grow"><AISearch size="sm" /><input placeholder="Buscar producto" aria-label="Buscar producto" value={q} onChange={(e) => setQ(e.target.value)} /></div></div>
      <section className="a-card flush" aria-label="Recetas">
        <div className="a-table">
          <div className="a-tr head" style={{ gridTemplateColumns: "48px minmax(0, 1.4fr) 110px 110px 110px 90px" }}><span /><span>Producto</span><span>Costo</span><span>Precio</span><span>Sugerido</span><span>Margen</span></div>
          {rows.map(({ p, v, r }) => {
            const b = r ? costOf(r.lines, supplies, avg, { extra: r.extraCost }) : null;
            const sug = b ? suggestedPrice(b.total, rules).price : null;
            const name = p.variants.length > 1 ? `${p.name} · ${v.label}` : p.name;
            return (
              <button key={`${p.id}/${v.id}`} type="button" className="a-tr inv-row" style={{ gridTemplateColumns: "48px minmax(0, 1.4fr) 110px 110px 110px 90px" }} onClick={() => setOpen({ product: p.id, variant: v.id })}>
                <span className="av">{p.images[0] ? <Thumb src={p.images[0]} /> : <span className="av-ph"><AIBox size="sm" /></span>}</span>
                <span className="stack" style={{ gap: 1, textAlign: "left" }}>
                  <b>{name || "Producto sin título"}</b>
                  <span className="a-cap">{r ? `${r.lines.length} ${r.lines.length === 1 ? "insumo" : "insumos"}${r.lines.some((l) => l.optional) ? " · con opcionales" : ""}` : "Sin receta"}</span>
                  <span className="c-m a-cap">{b ? `Costo ${money(b.total)} · precio ${money(v.price)} · sugerido ${money(sug ?? 0)}` : `Precio ${money(v.price)}`}</span>
                </span>
                <span className="c-d money">{b ? money(b.total) : "—"}</span>
                <span className="c-d money">{money(v.price)}</span>
                <span className="c-d money">{sug !== null ? money(sug) : "—"}</span>
                <span>{b ? <MarginTag price={v.price} cost={b.total} rules={rules} /> : <span className="a-cap c-d">—</span>}</span>
              </button>
            );
          })}
          {!rows.length && <p className="a-cap" style={{ padding: "14px 20px" }}>No hay productos que coincidan.</p>}
        </div>
      </section>
    </>
  );
}

function RecipeEditor({ product, variant, states, onDone }: { product: string; variant: string; states: Map<string, SupplyState>; onDone: () => void }) {
  const inv = useInventory();
  const { toast } = useAdmin();
  const { catalog } = useAdminCatalog();
  const { supplies, avg, recipe, rules } = useCosting(states);
  const p = catalog.products.find((x) => x.id === product);
  const v = p?.variants.find((x) => x.id === variant);
  const cur = recipe(product, variant);
  const [lines, setLines] = useState<{ supply: string; qty: string; optional: string }[]>(() => (cur?.lines ?? []).map((l) => ({ supply: l.supply, qty: String(l.qty), optional: l.optional ?? "" })));
  const [extra, setExtra] = useState(cur?.extraCost ? String(cur.extraCost) : "");
  const [busy, setBusy] = useState(false);
  const active = inv.data.supplies.filter((s) => !s.archived);

  const parsed: RecipeLine[] = lines
    .map((l) => ({ supply: l.supply, qty: parse(l.qty) ?? 0, optional: l.optional.trim() || undefined }))
    .filter((l) => l.supply && l.qty > 0);
  const ex = parse(extra) ?? 0;
  const base = costOf(parsed, supplies, avg, { extra: Number.isNaN(ex) ? 0 : ex });
  const all = costOf(parsed, supplies, avg, { extra: Number.isNaN(ex) ? 0 : ex, withOptionals: "all" });
  const hasOptionals = parsed.some((l) => l.optional);
  const sug = suggestedPrice(base.total, rules);

  const save = async () => {
    if (lines.some((l) => l.supply && !(parse(l.qty)! > 0))) return toast("Cada insumo necesita una cantidad mayor a 0");
    if (Number.isNaN(ex) || ex < 0) return toast("Revisa los extras");
    const r: Recipe = { product, variant, lines: parsed, extraCost: ex };
    setBusy(true);
    const ok = await inv.saveRecipe(r);
    setBusy(false);
    if (ok) { toast("Receta guardada"); onDone(); }
  };

  if (!p || !v) return <p className="a-cap">Este producto ya no existe. <button className="a-btn ghost sm" type="button" onClick={onDone}>Volver</button></p>;

  return (
    <>
      <button className="a-btn ghost sm" type="button" onClick={onDone} style={{ alignSelf: "flex-start" }}>← Todas las recetas</button>
      <section className="a-card" aria-labelledby="re-h">
        <div className="row g3">
          <span className="av" style={{ width: 56, height: 56 }}>{p.images[0] ? <Thumb src={p.images[0]} alt="" /> : <span className="av-ph"><AIBox /></span>}</span>
          <div className="stack g1 grow"><h2 className="a-h2" id="re-h">Receta de {p.variants.length > 1 ? `${p.name} · ${v.label}` : p.name}</h2><p className="a-cap">Precio en la tienda: {money(v.price)}</p></div>
        </div>
        {!active.length ? <p className="a-cap">Primero crea tus insumos en la pestaña Insumos.</p> : <>
          <div className="stack g2">
            {lines.map((l, i) => {
              const s = supplies.get(l.supply);
              return (
                <div key={i} className="q-line">
                  <select className="a-select" aria-label={`Insumo ${i + 1}`} value={l.supply} onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, supply: e.target.value } : x)))}>
                    <option value="">Elige un insumo</option>
                    {active.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                  <div className="a-prefix"><input inputMode="decimal" aria-label={`Cantidad del insumo ${i + 1}`} value={l.qty} onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, qty: e.target.value } : x)))} placeholder="0" /><span style={{ borderRight: 0, borderLeft: "1px solid var(--a-border-2)" }}>{s?.unit ?? "unid."}</span></div>
                  <input className="a-input" aria-label={`Opcional ${i + 1}`} placeholder="Opcional: p. ej. Con florero" value={l.optional} onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, optional: e.target.value } : x)))} />
                  <button className="a-btn ghost sm" type="button" aria-label={`Quitar insumo ${i + 1}`} onClick={() => setLines(lines.filter((_, j) => j !== i))}><AITrash size="sm" /></button>
                </div>
              );
            })}
            <button className="a-btn sm" type="button" style={{ alignSelf: "flex-start" }} onClick={() => setLines([...lines, { supply: "", qty: "", optional: "" }])}><AIPlus size="sm" />Agregar insumo</button>
            <p className="a-cap">Deja «Opcional» vacío si el insumo siempre va. Si lo llenas (por ejemplo «Con florero»), se cotiza aparte: con y sin.</p>
          </div>
          <div className="a-field" style={{ maxWidth: 260 }}><label htmlFor="re-x">Extras y consumibles sin stock</label><div className="a-prefix"><span>S/</span><input id="re-x" inputMode="decimal" value={extra} onChange={(e) => setExtra(e.target.value)} placeholder="0.00" /></div></div>
          <div className="q-sum">
            <Breakdown b={base} title={hasOptionals ? "Sin opcionales" : undefined} />
            {hasOptionals && <Breakdown b={all} title="Con todos los opcionales" />}
            <div className="stack g1">
              <div className="row between g2"><span>Precio sugerido</span><b className="money">{money(sug.price)}</b></div>
              <div className="row between g2"><span>Margen con el precio de la tienda</span><MarginTag price={v.price} cost={base.total} rules={rules} /></div>
              {hasOptionals && <div className="row between g2 a-cap"><span>Sugerido con opcionales</span><span className="money">{money(suggestedPrice(all.total, rules).price)}</span></div>}
            </div>
          </div>
          <div className="row g2"><button className="a-btn primary" type="button" disabled={busy} onClick={() => void save()}>{busy ? "Guardando…" : "Guardar receta"}</button><button className="a-btn ghost" type="button" onClick={onDone}>Cancelar</button></div>
        </>}
      </section>
    </>
  );
}

/* ───────────────────────── Cotizador ───────────────────────── */

function RulesCard() {
  const inv = useInventory();
  const { toast } = useAdmin();
  const { fees } = usePaymentFees();
  const r = inv.data.pricing;
  const [f, setF] = useState({ mode: r.mode, margin: String(r.margin), multiplier: String(r.multiplier), rounding: r.rounding, igv: r.igv });
  const dirty = f.mode !== r.mode || f.margin !== String(r.margin) || f.multiplier !== String(r.multiplier) || f.rounding !== r.rounding || f.igv !== r.igv;
  const save = async () => {
    const margin = parse(f.margin), mult = parse(f.multiplier);
    if (margin === null || Number.isNaN(margin) || margin < 0 || margin >= 95) return toast("El margen va de 0 a 94 %");
    if (mult === null || Number.isNaN(mult) || mult <= 0) return toast("El multiplicador debe ser mayor a 0");
    if (await inv.savePricing({ mode: f.mode, margin, multiplier: mult, rounding: f.rounding, igv: f.igv })) toast("Reglas de precio guardadas");
  };
  return (
    <details className="a-card q-rules">
      <summary><b>Reglas de precio</b> <span className="a-cap">{r.mode === "margin" ? `Margen ${r.margin}%` : `Costo × ${r.multiplier}`} · {ROUNDING_LABEL[r.rounding]} · {r.igv ? "con IGV" : "sin IGV"}</span></summary>
      <div className="a-seg" role="radiogroup" aria-label="Cómo calcular el precio">
        <button type="button" role="radio" aria-checked={f.mode === "margin"} className={f.mode === "margin" ? "on" : ""} onClick={() => setF({ ...f, mode: "margin" })}>Margen objetivo</button>
        <button type="button" role="radio" aria-checked={f.mode === "multiplier"} className={f.mode === "multiplier" ? "on" : ""} onClick={() => setF({ ...f, mode: "multiplier" })}>Multiplicador</button>
      </div>
      <div className="a-grid3">
        {f.mode === "margin"
          ? <div className="a-field"><label htmlFor="ru-m">Margen objetivo (%)</label><input id="ru-m" className="a-input" inputMode="decimal" value={f.margin} onChange={(e) => setF({ ...f, margin: e.target.value })} /><p className="a-cap">50 % = la mitad del precio es ganancia (precio = costo ÷ 0.5).</p></div>
          : <div className="a-field"><label htmlFor="ru-x">Multiplicador</label><input id="ru-x" className="a-input" inputMode="decimal" value={f.multiplier} onChange={(e) => setF({ ...f, multiplier: e.target.value })} /><p className="a-cap">Precio = costo × este número.</p></div>}
        <div className="a-field"><label htmlFor="ru-r">Redondeo</label>
          <select id="ru-r" className="a-select" value={f.rounding} onChange={(e) => setF({ ...f, rounding: e.target.value as Rounding })}>
            {(Object.keys(ROUNDING_LABEL) as Rounding[]).map((k) => <option key={k} value={k}>{ROUNDING_LABEL[k]}</option>)}
          </select>
        </div>
        <div className="a-field"><span style={{ fontSize: 13, fontWeight: 600 }}>IGV</span>
          <label className="row g2" style={{ minHeight: 44 }}><input type="checkbox" checked={f.igv} onChange={(e) => setF({ ...f, igv: e.target.checked })} style={{ width: 20, height: 20 }} />Sumar IGV ({fees.igvRate} %) al precio</label>
          <span className="a-cap">La tasa se cambia en <Link href="/admin/ajustes#pagos">Ajustes › Comisiones e IGV</Link>.</span>
        </div>
      </div>
      <p className="a-cap">La mano de obra se sumará más adelante (MVP v2).</p>
      <div className="row g2"><button className="a-btn primary" type="button" disabled={!dirty} onClick={() => void save()}>Guardar reglas</button></div>
    </details>
  );
}

type Draft = { id?: string; title: string; client: string; days: string; lines: (QuoteLine & { qtyText: string })[]; extra: string; price: string; note: string; status: QuoteStatus; createdAt?: string };

/** Costo de una cotización con los costos promedio de hoy. */
function quoteCost(lines: QuoteLine[], recipe: (p: string, v: string) => Recipe | undefined, supplies: Map<string, Supply>, avg: (id: string) => number, extra: number) {
  const q = quoteSupplies(lines, recipe);
  return costOf(q.supplies, supplies, avg, { extra: extra + q.extra });
}

function quoteText(q: { title: string; client: string; lines: QuoteLine[]; price: number; validUntil: string | null }, brand: string) {
  const items = q.lines.map((l) => `• ${qtyLabel(l.qty)} × ${l.name}${l.kind === "recipe" && l.optionals.length ? ` (${l.optionals.join(", ").toLowerCase()})` : ""}`);
  return [`*${brand}* · Cotización: ${q.title}`, q.client ? `Para: ${q.client}` : null, "", ...items, "", `Total: ${money(q.price)}`, q.validUntil ? `Válida hasta el ${dayLabel(q.validUntil)}` : null].filter((x) => x !== null).join("\n");
}

/** Inventario › Cotizador: reglas de precio, cotizaciones guardadas y armado de una cotización nueva. */
export function QuotesPanel({ states, today }: { states: Map<string, SupplyState>; today: string }) {
  const inv = useInventory();
  const { toast, bundle } = useAdmin();
  const { recipe, supplies, avg, rules } = useCosting(states);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [stockFor, setStockFor] = useState<Quote | null>(null);
  const discounted = (q: Quote) => inv.data.movements.some((m) => m.quoteId === q.id);

  const startNew = () => setDraft({ title: "", client: "", days: "3", lines: [], extra: "", price: "", note: "", status: "open" });
  const edit = (q: Quote) => setDraft({
    id: q.id, title: q.title, client: q.client, days: q.validUntil ? String(Math.max(0, Math.round((Date.parse(q.validUntil) - Date.parse(q.createdAt.slice(0, 10))) / 86400000))) : "",
    lines: q.lines.map((l) => ({ ...l, qtyText: String(l.qty) })), extra: q.extraCost ? String(q.extraCost) : "", price: String(q.price), note: q.note, status: q.status, createdAt: q.createdAt,
  });

  const copy = async (q: Quote) => {
    const text = quoteText(q, bundle.tenant.name);
    try { await navigator.clipboard.writeText(text); toast("Cotización copiada: pégala en WhatsApp"); } catch { toast("No se pudo copiar"); }
  };
  const setStatus = async (q: Quote, status: QuoteStatus) => {
    if (!(await inv.saveQuote({ ...q, status }))) return;
    toast(`Cotización: ${QUOTE_STATUS[status].toLowerCase()}`);
    // Al aceptarla, ofrece descontar sus insumos (si todavía no se descontaron).
    if (status === "accepted" && !discounted(q)) setStockFor({ ...q, status });
  };
  const giveBack = async (q: Quote) => {
    if (window.confirm(`¿Devolver al stock los insumos de «${q.title}»? Se borran sus salidas y el stock vuelve a como estaba.`) && (await inv.returnQuoteStock(q.id))) toast("Insumos devueltos al stock");
  };
  const remove = async (q: Quote) => { if (window.confirm(`¿Borrar la cotización «${q.title}»?`) && (await inv.deleteQuote(q.id))) toast("Cotización borrada"); };

  if (!inv.quotesAvailable) return <section className="a-card"><p>Falta preparar la base de datos: hay que correr la migración <b>0012_recipes_quotes</b> en Supabase.</p></section>;

  if (draft) return <QuoteBuilder draft={draft} setDraft={setDraft} today={today} states={states} />;
  if (stockFor) return <StockOutCard quote={stockFor} states={states} today={today} onDone={() => setStockFor(null)} />;

  const quotes = [...inv.data.quotes].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return (
    <>
      <RulesCard />
      <button className="a-btn primary" type="button" style={{ alignSelf: "flex-start" }} onClick={startNew}><AIPlus size="sm" />Nueva cotización</button>
      <section className="a-card flush" aria-label="Cotizaciones">
        <div className="a-table">
          {quotes.map((q) => {
            const now = quoteCost(q.lines, recipe, supplies, avg, q.extraCost);
            const expired = q.status === "open" && q.validUntil !== null && q.validUntil < today;
            const out = discounted(q);
            return (
              <div key={q.id} className="a-tr" style={{ gridTemplateColumns: "minmax(0, 1.4fr) 110px 90px 170px auto" }}>
                <button type="button" className="q-open" onClick={() => edit(q)}>
                  <b>{q.title}</b>
                  <span className="a-cap">{[q.client, dayLabel(q.createdAt.slice(0, 10)), expired ? "vencida" : q.validUntil ? `vale hasta ${dayLabel(q.validUntil)}` : null, out ? "stock descontado" : null].filter(Boolean).join(" · ")}</span>
                  <span className="c-m a-cap">{money(q.price)} · costo hoy {money(now.total)}</span>
                </button>
                <span className="c-d money">{money(q.price)}<span className="a-cap" style={{ display: "block" }}>costo hoy {money(now.total)}</span></span>
                <span className="c-d"><MarginTag price={q.price} cost={now.total} rules={rules} /></span>
                <select className="a-select c-d" aria-label={`Estado de ${q.title}`} value={q.status} onChange={(e) => void setStatus(q, e.target.value as QuoteStatus)}>
                  {(Object.keys(QUOTE_STATUS) as QuoteStatus[]).map((s) => <option key={s} value={s}>{QUOTE_STATUS[s]}</option>)}
                </select>
                <span className="row g1">
                  {out
                    ? <button className="a-btn ghost sm" type="button" aria-label={`Devolver al stock los insumos de ${q.title}`} title="Devolver al stock" onClick={() => void giveBack(q)}><AIUndo size="sm" /></button>
                    : q.status !== "lost" && <button className="a-btn ghost sm" type="button" aria-label={`Descontar del stock los insumos de ${q.title}`} title="Descontar del stock" onClick={() => setStockFor(q)}><AIBox size="sm" /></button>}
                  <button className="a-btn ghost sm" type="button" aria-label={`Copiar ${q.title} para WhatsApp`} onClick={() => void copy(q)}><AIWhatsApp size="sm" /></button>
                  <button className="a-btn ghost sm" type="button" aria-label={`Borrar ${q.title}`} onClick={() => void remove(q)}><AITrash size="sm" /></button>
                </span>
              </div>
            );
          })}
          {!quotes.length && <p className="a-cap" style={{ padding: "14px 20px" }}>Sin cotizaciones todavía. Arma una con productos que tengan receta o con insumos sueltos.</p>}
        </div>
      </section>
    </>
  );
}

/** Descuenta del stock los insumos de una cotización. Las cantidades salen de las recetas, pero se pueden cambiar (sustituciones). */
function StockOutCard({ quote, states, today, onDone }: { quote: Quote; states: Map<string, SupplyState>; today: string; onDone: () => void }) {
  const inv = useInventory();
  const { toast } = useAdmin();
  const { recipe, supplies } = useCosting(states);
  const needs = useMemo(() => quoteSupplies(quote.lines, recipe).supplies.filter((n) => supplies.has(n.supply)), [quote.lines, recipe, supplies]);
  const [qty, setQty] = useState<Record<string, string>>(() => Object.fromEntries(needs.map((n) => [n.supply, String(n.qty)])));
  const [day, setDay] = useState(today);
  const [busy, setBusy] = useState(false);
  const rows = needs.map((n) => {
    const s = supplies.get(n.supply)!;
    const v = parse(qty[n.supply] ?? "");
    const stock = states.get(s.id)?.stock ?? 0;
    return { s, v, stock, after: stock - (v !== null && !Number.isNaN(v) ? v : 0) };
  });
  const bad = rows.some((r) => r.v === null || Number.isNaN(r.v) || r.v < 0);
  const short = rows.filter((r) => r.after < 0);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (bad) return toast("Revisa las cantidades: deben ser 0 o más");
    const now = new Date().toISOString();
    const list = rows.filter((r) => (r.v ?? 0) > 0).map((r) => ({ id: newId(), createdAt: now, supplyId: r.s.id, kind: "sale" as const, qty: -(r.v ?? 0), quoteId: quote.id, note: `Cotización: ${quote.title}`, day }));
    if (!list.length) return toast("No hay nada que descontar");
    setBusy(true);
    const ok = await inv.addMovements(list);
    if (ok && quote.status === "open") await inv.saveQuote({ ...quote, status: "accepted" });
    setBusy(false);
    if (ok) {
      toast(`Stock descontado: ${list.length === 1 ? "1 insumo" : `${list.length} insumos`}`);
      onDone();
    }
  };

  return (
    <form className="a-card" onSubmit={save} aria-labelledby="so-h">
      <div className="a-card-h">
        <div className="stack g1"><h3 className="a-h2" id="so-h">Descontar del stock: {quote.title}</h3><p className="a-cap">Salen los insumos de la cotización. Si cambiaste algo al armarla (otra flor, una caja de más), corrige la cantidad.</p></div>
        <button className="a-btn ghost sm" type="button" onClick={onDone} aria-label="Cerrar"><AIClose size="sm" /></button>
      </div>
      {!rows.length ? <p className="a-cap">Esta cotización no tiene insumos con receta para descontar.</p> : (
        <div className="a-table so-table" aria-label="Insumos a descontar">
          {rows.map((r) => (
            <div key={r.s.id} className="a-tr so-tr" style={{ gridTemplateColumns: "minmax(0, 1.4fr) 160px 120px 120px" }}>
              <b>{r.s.name}</b>
              <div className="a-prefix"><input inputMode="decimal" aria-label={`Cantidad de ${r.s.name} que sale`} value={qty[r.s.id] ?? ""} onChange={(e) => setQty({ ...qty, [r.s.id]: e.target.value })} /><span style={{ borderRight: 0, borderLeft: "1px solid var(--a-border-2)" }}>{r.s.unit}</span></div>
              <span className="a-cap">Hay {unitsLabel(r.stock, r.s.unit)}</span>
              <span>{r.after < 0 ? <span className="st error">Queda {unitsLabel(r.after, r.s.unit)}</span> : <span className="a-cap">Queda {unitsLabel(r.after, r.s.unit)}</span>}</span>
            </div>
          ))}
        </div>
      )}
      {short.length > 0 && <p className="a-cap" role="status">No alcanza el stock de {short.map((r) => r.s.name).join(", ")}. Igual puedes descontar: quizá falta registrar una compra o hacer un conteo.</p>}
      <div className="a-grid3">
        <div className="a-field"><label htmlFor="so-d">Fecha</label><input id="so-d" className="a-input" type="date" max={today} value={day} onChange={(e) => setDay(e.target.value || today)} /></div>
      </div>
      {quote.status === "open" && <p className="a-cap">La cotización pasará a «Aceptada».</p>}
      <div className="row g2">
        <button className="a-btn primary" type="submit" disabled={busy || !rows.length}>Descontar del stock</button>
        <button className="a-btn ghost" type="button" onClick={onDone}>Ahora no</button>
      </div>
    </form>
  );
}

function QuoteBuilder({ draft, setDraft, today, states }: { draft: Draft; setDraft: (d: Draft | null) => void; today: string; states: Map<string, SupplyState> }) {
  const inv = useInventory();
  const { toast, bundle } = useAdmin();
  const { catalog } = useAdminCatalog();
  const { recipe, supplies, avg, rules } = useCosting(states);
  const [busy, setBusy] = useState(false);
  const d = draft;
  const set = (patch: Partial<Draft>) => setDraft({ ...d, ...patch });

  const withRecipe = catalog.products.flatMap((p) => p.variants.filter((v) => recipe(p.id, v.id)).map((v) => ({ key: `${p.id}\u0000${v.id}`, p, v, name: p.variants.length > 1 ? `${p.name} · ${v.label}` : p.name })));
  const active = inv.data.supplies.filter((s) => !s.archived);
  const lines: QuoteLine[] = d.lines.map((l) => ({ ...l, qty: parse(l.qtyText) ?? 0 })).filter((l) => l.qty > 0).map((l) => {
    const { qtyText: _t, ...rest } = l as QuoteLine & { qtyText: string };
    void _t;
    return rest;
  });
  const ex = parse(d.extra) ?? 0;
  const b = quoteCost(lines, recipe, supplies, avg, Number.isNaN(ex) ? 0 : ex);
  const sug = suggestedPrice(b.total, rules);
  const price = parse(d.price);
  const finalPrice = price === null || Number.isNaN(price) ? sug.price : price;
  const days = parse(d.days);
  const validUntil = days === null || Number.isNaN(days) ? null : shiftDay((d.createdAt ?? today).slice(0, 10), Math.round(days));

  const addRecipe = (key: string) => {
    const it = withRecipe.find((x) => x.key === key);
    if (it) set({ lines: [...d.lines, { kind: "recipe", product: it.p.id, variant: it.v.id, name: it.name, qty: 1, qtyText: "1", optionals: [] }] });
  };
  const addSupply = (id: string) => {
    const s = supplies.get(id);
    if (s) set({ lines: [...d.lines, { kind: "supply", supply: s.id, name: s.name, qty: 1, qtyText: "" }] });
  };
  const patchLine = (i: number, patch: Partial<QuoteLine & { qtyText: string }>) => set({ lines: d.lines.map((l, j) => (j === i ? ({ ...l, ...patch } as Draft["lines"][number]) : l)) });

  const save = async (andCopy: boolean) => {
    if (!d.title.trim()) return toast("Ponle un nombre a la cotización (p. ej. «Boda Pérez»)");
    if (!lines.length) return toast("Agrega al menos un producto o insumo");
    if (Number.isNaN(ex) || ex < 0) return toast("Revisa los extras");
    if (price !== null && (Number.isNaN(price) || price < 0)) return toast("Revisa el precio");
    const q: Quote = {
      id: d.id ?? newId(), title: d.title.trim(), client: d.client.trim(), lines, extraCost: ex, cost: b.total, suggested: sug.price, price: finalPrice,
      validUntil, status: d.status, note: d.note.trim(), createdAt: d.createdAt ?? new Date().toISOString(),
    };
    setBusy(true);
    const ok = await inv.saveQuote(q);
    setBusy(false);
    if (!ok) return;
    if (andCopy) {
      try { await navigator.clipboard.writeText(quoteText(q, bundle.tenant.name)); toast("Guardada y copiada: pégala en WhatsApp"); } catch { toast("Cotización guardada"); }
    } else toast("Cotización guardada");
    setDraft(null);
  };

  return (
    <section className="a-card" aria-labelledby="qb-h">
      <div className="a-card-h"><h2 className="a-h2" id="qb-h">{d.id ? "Editar cotización" : "Nueva cotización"}</h2><button className="a-btn ghost sm" type="button" onClick={() => setDraft(null)} aria-label="Cerrar"><AIClose size="sm" /></button></div>
      <div className="a-grid3">
        <div className="a-field"><label htmlFor="qb-t">Nombre</label><input id="qb-t" className="a-input" autoFocus={!d.id} value={d.title} onChange={(e) => set({ title: e.target.value })} placeholder="Ej.: Boda Pérez" /></div>
        <div className="a-field"><label htmlFor="qb-c">Cliente</label><input id="qb-c" className="a-input" value={d.client} onChange={(e) => set({ client: e.target.value })} placeholder="Opcional" /></div>
        <div className="a-field"><label htmlFor="qb-d">Vale por (días)</label><input id="qb-d" className="a-input" inputMode="numeric" value={d.days} onChange={(e) => set({ days: e.target.value })} placeholder="Vacío = sin vencimiento" /></div>
      </div>

      <div className="stack g2">
        {d.lines.map((l, i) => {
          const r = l.kind === "recipe" ? recipe(l.product, l.variant) : undefined;
          const optionals = r ? [...new Set(r.lines.map((x) => x.optional).filter((x): x is string => !!x))] : [];
          const s = l.kind === "supply" ? supplies.get(l.supply) : undefined;
          return (
            <div key={i} className="q-item">
              <div className="row between g2">
                <b>{l.name}{l.kind === "supply" ? <span className="a-cap"> · insumo suelto</span> : null}</b>
                <button className="a-btn ghost sm" type="button" aria-label={`Quitar ${l.name}`} onClick={() => set({ lines: d.lines.filter((_, j) => j !== i) })}><AITrash size="sm" /></button>
              </div>
              <div className="row g3" style={{ flexWrap: "wrap" }}>
                <div className="a-prefix" style={{ maxWidth: 200 }}><span>Cantidad</span><input inputMode="decimal" aria-label={`Cantidad de ${l.name}`} value={l.qtyText} onChange={(e) => patchLine(i, { qtyText: e.target.value })} /></div>
                {s && <span className="a-cap">{s.unit}</span>}
                {optionals.map((o) => (
                  <label key={o} className="row g2" style={{ minHeight: 44 }}>
                    <input type="checkbox" style={{ width: 20, height: 20 }} checked={l.kind === "recipe" && l.optionals.includes(o)} onChange={(e) => l.kind === "recipe" && patchLine(i, { optionals: e.target.checked ? [...l.optionals, o] : l.optionals.filter((x) => x !== o) })} />{o}
                  </label>
                ))}
              </div>
            </div>
          );
        })}
        <div className="q-adds">
          <select className="a-select" aria-label="Agregar producto con receta" value="" onChange={(e) => addRecipe(e.target.value)}>
            <option value="">+ Agregar producto con receta…</option>
            {withRecipe.map((x) => <option key={x.key} value={x.key}>{x.name}</option>)}
          </select>
          <select className="a-select" aria-label="Agregar insumo suelto" value="" onChange={(e) => addSupply(e.target.value)}>
            <option value="">+ Agregar insumo suelto…</option>
            {active.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        {!withRecipe.length && <p className="a-cap">Ningún producto tiene receta todavía: agrégala en la pestaña Recetas, o cotiza con insumos sueltos.</p>}
      </div>

      <div className="a-field" style={{ maxWidth: 260 }}><label htmlFor="qb-x">Extras (movilidad, base, montaje)</label><div className="a-prefix"><span>S/</span><input id="qb-x" inputMode="decimal" value={d.extra} onChange={(e) => set({ extra: e.target.value })} placeholder="0.00" /></div></div>

      <div className="q-sum">
        <Breakdown b={b} />
        <div className="stack g2">
          <div className="row between g2"><span>Precio sugerido <span className="a-cap">({rules.mode === "margin" ? `margen ${rules.margin}%` : `× ${rules.multiplier}`}{rules.igv ? ", con IGV" : ""})</span></span><b className="money">{money(sug.price)}</b></div>
          <div className="a-field"><label htmlFor="qb-p">Precio para el cliente</label><div className="a-prefix"><span>S/</span><input id="qb-p" inputMode="decimal" value={d.price} onChange={(e) => set({ price: e.target.value })} placeholder={sug.price.toFixed(2)} /></div></div>
          <div className="row between g2"><span>Margen real</span><MarginTag price={finalPrice} cost={b.total} rules={rules} /></div>
          {validUntil && <p className="a-cap">Vale hasta el {dayLabel(validUntil)}: el costo de los insumos cambia.</p>}
        </div>
      </div>
      <div className="a-field"><label htmlFor="qb-n">Nota interna</label><input id="qb-n" className="a-input" value={d.note} onChange={(e) => set({ note: e.target.value })} placeholder="Opcional" /></div>
      <div className="row g2" style={{ flexWrap: "wrap" }}>
        <button className="a-btn primary" type="button" disabled={busy} onClick={() => void save(true)}><AIWhatsApp size="sm" />Guardar y copiar para WhatsApp</button>
        <button className="a-btn" type="button" disabled={busy} onClick={() => void save(false)}>Solo guardar</button>
        <button className="a-btn ghost" type="button" onClick={() => setDraft(null)}>Cancelar</button>
      </div>
    </section>
  );
}
