"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { formatPrice } from "@/lib/format";
import { useToday } from "@/lib/useToday";
import {
  KIND_LABEL, newId, purchaseMovement, qtyLabel, supplyState, unitsLabel,
  type Movement, type MovementKind, type PurchaseUnit, type Supplier, type Supply, type SupplyState,
} from "@/lib/inventory";
import { useAdmin } from "../AdminContext";
import { useInventory } from "../AdminInventory";
import { AdminPage, DemoNote } from "../AdminPage";
import { dayLabel } from "../AdminSales";
import { Thumb, UploadButton } from "../PhotoPicker";
import { AIBox, AIClose, AIPlus, AISearch, AITrash } from "../AdminIcons";

const TABS = [
  { id: "insumos", label: "Insumos" },
  { id: "compras", label: "Compras" },
  { id: "proveedores", label: "Proveedores" },
] as const;
type TabId = (typeof TABS)[number]["id"];
const isTab = (v: string): v is TabId => TABS.some((t) => t.id === v);

/** Número escrito en un campo (acepta coma) → número; vacío = null; inválido = NaN. */
const parse = (s: string): number | null => {
  const t = s.replace(",", ".").trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : NaN;
};
const money = (n: number) => formatPrice(Math.round(n * 100) / 100);

/** Admin › Inventario: insumos con su stock y costo promedio, compras por proveedor y proveedores. */
export function InventoryView() {
  const inv = useInventory();
  const today = useToday();
  const [tab, setTab] = useState<TabId>("insumos");
  const [open, setOpen] = useState<string | null>(null);
  const tabRefs = useRef<Record<TabId, HTMLButtonElement | null>>({ insumos: null, compras: null, proveedores: null });
  useEffect(() => {
    const sync = () => { const h = window.location.hash.slice(1); if (isTab(h)) setTab(h); };
    sync();
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);
  const pick = (id: TabId, focus = false) => {
    setTab(id);
    setOpen(null);
    history.replaceState(null, "", `#${id}`);
    if (focus) tabRefs.current[id]?.focus();
  };
  const onTabKey = (e: React.KeyboardEvent) => {
    const i = TABS.findIndex((t) => t.id === tab);
    const next = e.key === "ArrowRight" ? i + 1 : e.key === "ArrowLeft" ? i - 1 : e.key === "Home" ? 0 : e.key === "End" ? TABS.length - 1 : null;
    if (next === null) return;
    e.preventDefault();
    pick(TABS[(next + TABS.length) % TABS.length].id, true);
  };

  const states = useMemo(() => {
    const m = new Map<string, SupplyState>();
    if (today) for (const s of inv.data.supplies) m.set(s.id, supplyState(s, inv.data.movements, today));
    return m;
  }, [inv.data.supplies, inv.data.movements, today]);

  const sub = {
    insumos: "Lo que compras para armar tus productos, con su stock y costo promedio.",
    compras: "Cada compra recalcula el costo promedio. Aquí queda dónde compraste y a cuánto.",
    proveedores: "Dónde compras: nacional o importado, y cuánto tardan en entregar.",
  }[tab];

  if (!today || !inv.hydrated) {
    return (
      <AdminPage title="Inventario">
        <div className="a-head"><div className="stack g1"><h1 className="a-h1">Inventario</h1></div></div>
        <p className="a-cap" role="status">Cargando…</p>
      </AdminPage>
    );
  }

  if (!inv.available) {
    return (
      <AdminPage title="Inventario">
        <div className="a-head"><div className="stack g1"><h1 className="a-h1">Inventario</h1></div></div>
        <section className="a-card"><p>Falta preparar la base de datos: hay que correr la migración <b>0011_inventory</b> en Supabase.</p></section>
      </AdminPage>
    );
  }

  if (!inv.data.enabled) {
    return (
      <AdminPage title="Inventario">
        <div className="a-head"><div className="stack g1"><h1 className="a-h1">Inventario</h1><p className="a-sub">Insumos, compras por proveedor y costo promedio.</p></div></div>
        <section className="a-card" aria-labelledby="inv-off">
          <h2 className="a-h2" id="inv-off">El inventario está apagado para tu marca</h2>
          <p className="a-cap">Actívalo si armas tus productos con insumos que compras (flores, cajas, papel, cintas). No cambia nada de tu tienda: el stock que ve el cliente sigue igual.</p>
          <div className="row g2"><button className="a-btn primary" type="button" onClick={() => void inv.setEnabled(true)}>Activar inventario</button><Link className="a-btn ghost" href="/admin/ajustes#modulos">Ver en Ajustes</Link></div>
        </section>
      </AdminPage>
    );
  }

  const openSupply = open ? inv.data.supplies.find((s) => s.id === open) : undefined;

  return (
    <AdminPage title="Inventario">
      <div className="a-head"><div className="stack g1"><h1 className="a-h1">Inventario</h1><p className="a-sub">{sub}</p></div></div>
      <div className="a-seg a-tabs" role="tablist" aria-label="Secciones de inventario" onKeyDown={onTabKey}>
        {TABS.map((t) => (
          <button key={t.id} ref={(el) => { tabRefs.current[t.id] = el; }} id={`inv-tab-${t.id}`} type="button" role="tab" className={tab === t.id ? "on" : ""} aria-selected={tab === t.id} aria-controls={`inv-panel-${t.id}`} tabIndex={tab === t.id ? 0 : -1} onClick={() => pick(t.id)}>{t.label}</button>
        ))}
      </div>
      <div role="tabpanel" id={`inv-panel-${tab}`} aria-labelledby={`inv-tab-${tab}`} className="stack g5">
        {tab === "insumos" ? (
          openSupply ? <SupplyDetail supply={openSupply} st={states.get(openSupply.id)!} today={today} onBack={() => setOpen(null)} />
            : <SuppliesList states={states} onOpen={setOpen} />
        ) : tab === "compras" ? <PurchasesPanel today={today} states={states} /> : <SuppliersPanel />}
      </div>
      <DemoNote untilDb>Demo: el inventario se guarda en este navegador.</DemoNote>
    </AdminPage>
  );
}

/* ───────────────────────── Insumos ───────────────────────── */

function SuppliesList({ states, onOpen }: { states: Map<string, SupplyState>; onOpen: (id: string) => void }) {
  const { data } = useInventory();
  const [q, setQ] = useState("");
  const [lowOnly, setLowOnly] = useState(false);
  const [adding, setAdding] = useState(false);
  const sup = (id?: string) => data.suppliers.find((s) => s.id === id)?.name;
  const list = data.supplies
    .filter((s) => !s.archived)
    .filter((s) => !q || `${s.name} ${s.category}`.toLowerCase().includes(q.toLowerCase()))
    .filter((s) => !lowOnly || states.get(s.id)?.low)
    .sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));
  const lowCount = data.supplies.filter((s) => !s.archived && states.get(s.id)?.low).length;
  const total = data.supplies.reduce((n, s) => n + (states.get(s.id)?.value ?? 0), 0);

  if (adding) return <SupplyForm onDone={(id) => { setAdding(false); if (id) onOpen(id); }} />;

  return (
    <>
      <div className="filters-bar">
        <div className="a-search grow"><AISearch size="sm" /><input placeholder="Buscar insumo" aria-label="Buscar insumo" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <button className={`a-chip ${lowOnly ? "on" : ""}`} type="button" aria-pressed={lowOnly} onClick={() => setLowOnly((v) => !v)}>Stock bajo {!!lowCount && <span className="n">{lowCount}</span>}</button>
        <button className="a-btn primary" type="button" onClick={() => setAdding(true)}><AIPlus size="sm" />Nuevo insumo</button>
      </div>
      <section className="a-card flush" aria-label="Insumos">
        <div className="a-card-h"><b>{list.length} {list.length === 1 ? "insumo" : "insumos"}</b><span className="a-cap">Valor del stock: <b className="money">{money(total)}</b></span></div>
        <div className="a-table">
          <div className="a-tr head" style={{ gridTemplateColumns: "48px minmax(0, 1.4fr) 150px 130px minmax(0, 1.2fr)" }}><span /><span>Insumo</span><span>Stock</span><span>Costo promedio</span><span>Última compra</span></div>
          {list.map((s) => {
            const st = states.get(s.id);
            if (!st) return null;
            const last = st.last ? `${sup(st.last.supplierId) ?? "Sin proveedor"} · ${dayLabel(st.last.day)} · ${money(st.last.unitCost)}` : "Sin compras";
            return (
              <button key={s.id} type="button" className="a-tr inv-row" onClick={() => onOpen(s.id)} style={{ gridTemplateColumns: "48px minmax(0, 1.4fr) 150px 130px minmax(0, 1.2fr)" }}>
                <span className="av">{s.photos[0] ? <Thumb src={s.photos[0]} /> : <span className="av-ph"><AIBox size="sm" /></span>}</span>
                <span className="stack" style={{ gap: 1, textAlign: "left" }}>
                  <b>{s.name}</b>
                  <span className="a-cap">{s.category || "Sin categoría"}</span>
                  <span className="c-m a-cap">{unitsLabel(st.stock, s.unit)} · {money(st.avgCost)} c/u · {last}</span>
                </span>
                <span className="c-d">{st.low ? <span className="st bajo">{unitsLabel(st.stock, s.unit)}</span> : unitsLabel(st.stock, s.unit)}</span>
                <span className="c-d money">{st.avgCost ? `${money(st.avgCost)} / ${s.unit}` : "—"}</span>
                <span className="c-d a-cap" style={{ textAlign: "left" }}>{last}</span>
                {st.low && <span className="c-m"><span className="st bajo">Stock bajo</span></span>}
              </button>
            );
          })}
          {!list.length && <p className="a-cap" style={{ padding: "14px 20px" }}>{data.supplies.length ? "Ningún insumo coincide." : "Todavía no tienes insumos. Crea el primero: por ejemplo «Rosa roja», que compras por paquete de 25 tallos."}</p>}
        </div>
      </section>
    </>
  );
}

function SupplyForm({ supply, onDone }: { supply?: Supply; onDone: (id?: string) => void }) {
  const inv = useInventory();
  const { toast } = useAdmin();
  const [f, setF] = useState(() => ({
    name: supply?.name ?? "",
    category: supply?.category ?? "",
    unit: supply?.unit ?? "unidad",
    units: (supply?.purchaseUnits ?? []).map((u) => ({ name: u.name, factor: String(u.factor) })),
    min: supply?.minStock === null || supply?.minStock === undefined ? "" : String(supply.minStock),
    shelf: supply?.shelfDays ? String(supply.shelfDays) : "",
    waste: supply?.wastePct === null || supply?.wastePct === undefined ? "" : String(supply.wastePct),
    photos: supply?.photos ?? [],
    note: supply?.note ?? "",
  }));
  const [busy, setBusy] = useState(false);
  const cats = [...new Set(inv.data.supplies.map((s) => s.category).filter(Boolean))];

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = f.name.trim();
    const unit = f.unit.trim();
    if (!name) return toast("Escribe el nombre del insumo");
    if (!unit) return toast("Escribe la unidad de uso (tallo, vara, unidad…)");
    if (inv.data.supplies.some((s) => s.id !== supply?.id && !s.archived && s.name.toLowerCase() === name.toLowerCase())) return toast(`Ya tienes un insumo llamado «${name}»`);
    const units: PurchaseUnit[] = [];
    for (const u of f.units) {
      if (!u.name.trim() && !u.factor.trim()) continue;
      const factor = parse(u.factor);
      if (!u.name.trim() || factor === null || !(factor > 0)) return toast("Cada unidad de compra necesita nombre y cuántas unidades trae");
      units.push({ name: u.name.trim(), factor });
    }
    const min = parse(f.min), shelf = parse(f.shelf), waste = parse(f.waste);
    if (Number.isNaN(min) || (min ?? 0) < 0) return toast("Revisa el stock mínimo");
    if (Number.isNaN(shelf) || (shelf !== null && !(shelf > 0))) return toast("Revisa la vida útil");
    if (Number.isNaN(waste) || (waste !== null && (waste < 0 || waste >= 100))) return toast("La merma esperada va de 0 a 99 %");
    const next: Supply = {
      id: supply?.id ?? newId(), name, category: f.category.trim(), unit, purchaseUnits: units, minStock: min, shelfDays: shelf === null ? null : Math.round(shelf),
      wastePct: waste, photos: f.photos, note: f.note.trim(), archived: supply?.archived ?? false,
    };
    setBusy(true);
    const ok = await inv.saveSupply(next);
    setBusy(false);
    if (ok) { toast(supply ? "Insumo guardado" : "Insumo creado"); onDone(next.id); }
  };

  return (
    <form className="a-card" onSubmit={save} aria-labelledby="sf-h">
      <div className="a-card-h"><h2 className="a-h2" id="sf-h">{supply ? `Editar ${supply.name}` : "Nuevo insumo"}</h2><button className="a-btn ghost sm" type="button" onClick={() => onDone()} aria-label="Cerrar"><AIClose size="sm" /></button></div>
      <div className="a-grid2">
        <div className="a-field"><label htmlFor="sf-n">Nombre</label><input id="sf-n" className="a-input" autoFocus={!supply} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Ej.: Rosa roja" /></div>
        <div className="a-field"><label htmlFor="sf-c">Categoría</label><input id="sf-c" className="a-input" list="sf-cats" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} placeholder="Ej.: Flor, Follaje, Empaque" /><datalist id="sf-cats">{cats.map((c) => <option key={c} value={c} />)}</datalist></div>
      </div>
      <div className="a-field">
        <label htmlFor="sf-u">Unidad de uso</label>
        <input id="sf-u" className="a-input" value={f.unit} onChange={(e) => setF({ ...f, unit: e.target.value })} placeholder="Ej.: tallo" />
        <p className="a-cap">La unidad en que cuentas el stock y que usarán las recetas: tallo, vara, pliego, metro, unidad.</p>
      </div>
      <fieldset className="a-field" style={{ border: 0, padding: 0, margin: 0 }}>
        <legend style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Unidades de compra</legend>
        <p className="a-cap">Cómo lo compras, si no es por {f.unit || "unidad"}. Ej.: 1 paquete = 25 tallos.</p>
        {f.units.map((u, i) => (
          <div key={i} className="row g2">
            <span className="a-cap">1</span>
            <input className="a-input" aria-label={`Nombre de la unidad de compra ${i + 1}`} placeholder="paquete" value={u.name} onChange={(e) => setF({ ...f, units: f.units.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)) })} />
            <span className="a-cap">=</span>
            <input className="a-input" style={{ maxWidth: 110 }} inputMode="decimal" aria-label={`Cuántas unidades de uso trae la unidad de compra ${i + 1}`} placeholder="25" value={u.factor} onChange={(e) => setF({ ...f, units: f.units.map((x, j) => (j === i ? { ...x, factor: e.target.value } : x)) })} />
            <span className="a-cap" style={{ whiteSpace: "nowrap" }}>{f.unit || "unidades"}</span>
            <button className="a-btn ghost sm" type="button" aria-label={`Quitar unidad de compra ${i + 1}`} onClick={() => setF({ ...f, units: f.units.filter((_, j) => j !== i) })}><AITrash size="sm" /></button>
          </div>
        ))}
        <button className="a-btn sm" type="button" style={{ alignSelf: "flex-start" }} onClick={() => setF({ ...f, units: [...f.units, { name: "", factor: "" }] })}><AIPlus size="sm" />Agregar unidad de compra</button>
      </fieldset>
      <div className="a-grid3">
        <div className="a-field"><label htmlFor="sf-m">Stock mínimo ({f.unit || "unidades"})</label><input id="sf-m" className="a-input" inputMode="decimal" value={f.min} onChange={(e) => setF({ ...f, min: e.target.value })} placeholder="Ej.: 50" /></div>
        <div className="a-field"><label htmlFor="sf-s">Vida útil (días)</label><input id="sf-s" className="a-input" inputMode="numeric" value={f.shelf} onChange={(e) => setF({ ...f, shelf: e.target.value })} placeholder="Vacío = no vence" /></div>
        <div className="a-field"><label htmlFor="sf-w">Merma esperada (%)</label><input id="sf-w" className="a-input" inputMode="decimal" value={f.waste} onChange={(e) => setF({ ...f, waste: e.target.value })} placeholder="Ej.: 8" /></div>
      </div>
      <div className="a-field">
        <span style={{ fontSize: 13, fontWeight: 600 }}>Fotos</span>
        <p className="a-cap">Para que quien compra o arma sepa exactamente cuál es.</p>
        <div className="row g2" style={{ flexWrap: "wrap" }}>
          {f.photos.map((p) => (
            <span key={p} className="inv-photo"><Thumb src={p} alt={f.name} /><button type="button" className="a-btn ghost sm" aria-label="Quitar foto" onClick={() => setF({ ...f, photos: f.photos.filter((x) => x !== p) })}><AIClose size="sm" /></button></span>
          ))}
          <UploadButton label="Subir foto" onUploaded={(srcs) => setF((x) => ({ ...x, photos: [...x.photos, ...srcs] }))} />
        </div>
      </div>
      <div className="a-field"><label htmlFor="sf-no">Nota</label><input id="sf-no" className="a-input" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} placeholder="Opcional" /></div>
      <div className="row g2"><button className="a-btn primary" type="submit" disabled={busy}>{busy ? "Guardando…" : "Guardar"}</button><button className="a-btn ghost" type="button" onClick={() => onDone()}>Cancelar</button></div>
    </form>
  );
}

function SupplyDetail({ supply, st, today, onBack }: { supply: Supply; st: SupplyState; today: string; onBack: () => void }) {
  const inv = useInventory();
  const { toast } = useAdmin();
  const [mode, setMode] = useState<"view" | "edit" | "buy" | "adjust">("view");
  const sup = (id?: string) => inv.data.suppliers.find((s) => s.id === id)?.name ?? "Sin proveedor";
  const moves = inv.data.movements.filter((m) => m.supplyId === supply.id).sort((a, b) => b.day.localeCompare(a.day) || b.createdAt.localeCompare(a.createdAt));

  if (mode === "edit") return <SupplyForm supply={supply} onDone={() => setMode("view")} />;

  const remove = async (m: Movement) => {
    if (!window.confirm(`¿Borrar ${KIND_LABEL[m.kind].toLowerCase()} del ${dayLabel(m.day)}? El stock y el costo promedio se recalculan.`)) return;
    if (await inv.deleteMovement(m.id)) toast("Movimiento borrado");
  };

  return (
    <>
      <button className="a-btn ghost sm" type="button" onClick={onBack} style={{ alignSelf: "flex-start" }}>← Todos los insumos</button>
      <section className="a-card" aria-labelledby="sd-h">
        <div className="row g3" style={{ alignItems: "flex-start" }}>
          <span className="av" style={{ width: 72, height: 72 }}>{supply.photos[0] ? <Thumb src={supply.photos[0]} alt={supply.name} /> : <span className="av-ph"><AIBox /></span>}</span>
          <div className="stack g1 grow">
            <h2 className="a-h2" id="sd-h">{supply.name}</h2>
            <p className="a-cap">{[supply.category, `se cuenta por ${supply.unit}`, ...supply.purchaseUnits.map((u) => `1 ${u.name} = ${unitsLabel(u.factor, supply.unit)}`)].filter(Boolean).join(" · ")}</p>
          </div>
          <button className="a-btn sm" type="button" onClick={() => setMode("edit")}>Editar</button>
        </div>
        <div className="inv-stats">
          <div><span className="a-cap">Stock</span><b>{unitsLabel(st.stock, supply.unit)}</b>{st.low && <span className="st bajo">Bajo el mínimo ({qtyLabel(supply.minStock ?? 0)})</span>}</div>
          <div><span className="a-cap">Costo promedio</span><b className="money">{money(st.avgCost)}</b><span className="a-cap">por {supply.unit}</span></div>
          <div><span className="a-cap">Última compra</span><b className="money">{st.last ? money(st.last.unitCost) : "—"}</b><span className="a-cap">{st.last ? `${sup(st.last.supplierId)} · ${dayLabel(st.last.day)}` : "Sin compras"}</span></div>
          <div><span className="a-cap">Merma (30 días)</span><b className="money">{money(st.wasteValue30)}</b><span className="a-cap">Valor del stock: {money(st.value)}</span></div>
        </div>
        {supply.photos.length > 1 && <div className="row g2" style={{ flexWrap: "wrap" }}>{supply.photos.slice(1).map((p) => <span key={p} className="inv-photo"><Thumb src={p} alt={supply.name} /></span>)}</div>}
        <div className="row g2" style={{ flexWrap: "wrap" }}>
          <button className="a-btn primary" type="button" onClick={() => setMode("buy")}>Registrar compra</button>
          <button className="a-btn" type="button" onClick={() => setMode("adjust")}>Merma o ajuste</button>
        </div>
      </section>

      {mode === "buy" && <PurchaseForm today={today} supplyId={supply.id} states={new Map([[supply.id, st]])} onDone={() => setMode("view")} />}
      {mode === "adjust" && <AdjustForm supply={supply} st={st} today={today} onDone={() => setMode("view")} />}

      <section className="a-card flush" aria-labelledby="sd-prov">
        <div className="a-card-h"><h3 className="a-h2" id="sd-prov">Precio por proveedor</h3></div>
        <div className="a-table">
          <div className="a-tr head" style={{ gridTemplateColumns: "minmax(0, 1fr) 140px 140px 110px" }}><span>Proveedor</span><span>Última compra</span><span>Promedio ahí</span><span>Compras</span></div>
          {st.bySupplier.map((p) => (
            <div key={p.supplierId} className="a-tr" style={{ gridTemplateColumns: "minmax(0, 1fr) 140px 140px 110px" }}>
              <span className="stack" style={{ gap: 1 }}><b>{sup(p.supplierId)}</b><span className="c-m a-cap">Última {money(p.last.unitCost)} ({dayLabel(p.last.day)}) · promedio {money(p.avgUnitCost)}</span></span>
              <span className="c-d money">{money(p.last.unitCost)} <span className="a-cap">{dayLabel(p.last.day)}</span></span>
              <span className="c-d money">{money(p.avgUnitCost)}</span>
              <span className="c-d">{p.purchases}</span>
            </div>
          ))}
          {!st.bySupplier.length && <p className="a-cap" style={{ padding: "14px 20px" }}>Cuando registres compras con proveedor, aquí comparas a cuánto compras en cada sitio.</p>}
        </div>
      </section>

      <section className="a-card flush" aria-labelledby="sd-hist">
        <div className="a-card-h"><h3 className="a-h2" id="sd-hist">Historial</h3></div>
        <div className="a-table">
          {moves.map((m) => <MovementRow key={m.id} m={m} unit={supply.unit} supplier={m.supplierId ? sup(m.supplierId) : undefined} onDelete={() => void remove(m)} />)}
          {!moves.length && <p className="a-cap" style={{ padding: "14px 20px" }}>Sin movimientos todavía.</p>}
        </div>
      </section>
    </>
  );
}

function MovementRow({ m, unit, supplier, supplyName, onDelete }: { m: Movement; unit: string; supplier?: string; supplyName?: string; onDelete?: () => void }) {
  const unitCost = m.kind === "purchase" && m.qty > 0 ? (m.amount ?? 0) / m.qty : null;
  const detail = m.kind === "purchase"
    ? [supplier, m.purchaseQty && m.purchaseUnit ? unitsLabel(m.purchaseQty, m.purchaseUnit) : null, m.badQty ? `${unitsLabel(m.badQty, unit)} malas` : null, m.note].filter(Boolean).join(" · ")
    : m.note;
  return (
    <div className="a-tr" style={{ gridTemplateColumns: "70px minmax(0, 1fr) 140px 120px 44px" }}>
      <span className="a-cap">{dayLabel(m.day)}</span>
      <span className="stack" style={{ gap: 1 }}>
        <b>{supplyName ? `${supplyName} · ` : ""}{KIND_LABEL[m.kind]}</b>
        {detail && <span className="a-cap">{detail}</span>}
        <span className="c-m a-cap">{m.qty > 0 ? "+" : ""}{unitsLabel(m.qty, unit)}{m.kind === "purchase" ? ` · ${money(m.amount ?? 0)}${unitCost !== null ? ` (${money(unitCost)} c/u)` : ""}` : ""}</span>
      </span>
      <span className="c-d" style={{ color: m.qty < 0 ? "#B42318" : undefined }}>{m.qty > 0 ? "+" : ""}{unitsLabel(m.qty, unit)}</span>
      <span className="c-d money">{m.kind === "purchase" ? <>{money(m.amount ?? 0)}{unitCost !== null && <span className="a-cap" style={{ display: "block" }}>{money(unitCost)} c/u</span>}</> : ""}</span>
      {onDelete ? <button className="a-btn ghost sm" type="button" aria-label="Borrar movimiento" onClick={onDelete}><AITrash size="sm" /></button> : <span />}
    </div>
  );
}

function AdjustForm({ supply, st, today, onDone }: { supply: Supply; st: SupplyState; today: string; onDone: () => void }) {
  const inv = useInventory();
  const { toast } = useAdmin();
  const [kind, setKind] = useState<Exclude<MovementKind, "purchase">>("waste");
  const [qty, setQty] = useState("");
  const [note, setNote] = useState("");
  const [day, setDay] = useState(today);
  const n = parse(qty);
  // En «Ajuste por conteo» se escribe cuánto hay contado; el resto, cuánto salió.
  const delta = n === null || Number.isNaN(n) ? null : kind === "adjust" ? n - st.stock : -Math.abs(n);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (delta === null || (kind === "adjust" ? (n ?? -1) < 0 : !(Math.abs(n ?? 0) > 0))) return toast(kind === "adjust" ? "Escribe cuánto contaste" : "Escribe cuánto salió");
    if (delta === 0) return toast("El conteo coincide con el stock: no hay nada que ajustar");
    const ok = await inv.addMovements([{ id: newId(), createdAt: new Date().toISOString(), supplyId: supply.id, kind, qty: delta, note: note.trim(), day }]);
    if (ok) { toast("Stock actualizado"); onDone(); }
  };

  return (
    <form className="a-card" onSubmit={save} aria-labelledby="af-h">
      <div className="a-card-h"><h3 className="a-h2" id="af-h">Merma o ajuste de {supply.name}</h3><button className="a-btn ghost sm" type="button" onClick={onDone} aria-label="Cerrar"><AIClose size="sm" /></button></div>
      <div className="a-seg" role="radiogroup" aria-label="Tipo de cambio">
        {(["waste", "use", "adjust"] as const).map((k) => <button key={k} type="button" role="radio" aria-checked={kind === k} className={kind === k ? "on" : ""} onClick={() => setKind(k)}>{k === "waste" ? "Merma" : k === "use" ? "Uso interno" : "Conteo"}</button>)}
      </div>
      <p className="a-cap">{kind === "waste" ? "Lo que se pasó, se rompió o llegó mal después. Sale al costo promedio y cuenta como pérdida." : kind === "use" ? "Lo que usaste sin vender: muestras, fotos para Instagram." : `Cuenta lo que hay y escríbelo. Hoy el sistema tiene ${unitsLabel(st.stock, supply.unit)}.`}</p>
      <div className="a-grid3">
        <div className="a-field"><label htmlFor="af-q">{kind === "adjust" ? `Contaste (${supply.unit})` : `Cantidad (${supply.unit})`}</label><input id="af-q" className="a-input" inputMode="decimal" autoFocus value={qty} onChange={(e) => setQty(e.target.value)} /></div>
        <div className="a-field"><label htmlFor="af-d">Fecha</label><input id="af-d" className="a-input" type="date" max={today} value={day} onChange={(e) => setDay(e.target.value || today)} /></div>
        <div className="a-field"><label htmlFor="af-n">Nota</label><input id="af-n" className="a-input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Opcional" /></div>
      </div>
      {delta !== null && delta !== 0 && <p className="a-cap">Stock nuevo: <b>{unitsLabel(st.stock + delta, supply.unit)}</b> ({delta > 0 ? "+" : ""}{qtyLabel(delta)})</p>}
      <div className="row g2"><button className="a-btn primary" type="submit">Guardar</button><button className="a-btn ghost" type="button" onClick={onDone}>Cancelar</button></div>
    </form>
  );
}

/* ───────────────────────── Compras ───────────────────────── */

function PurchaseForm({ today, supplyId, states, onDone }: { today: string; supplyId?: string; states: Map<string, SupplyState>; onDone: () => void }) {
  const inv = useInventory();
  const { toast } = useAdmin();
  const supplies = inv.data.supplies.filter((s) => !s.archived);
  const suppliers = inv.data.suppliers.filter((s) => !s.archived);
  const [f, setF] = useState({ supplyId: supplyId ?? "", supplierId: "", qty: "", unit: "", bad: "", amount: "", day: today, note: "", receipt: "" });
  const [newSup, setNewSup] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const supply = supplies.find((s) => s.id === f.supplyId);
  const unitName = f.unit || supply?.purchaseUnits[0]?.name || supply?.unit || "";
  const factor = !supply ? 0 : unitName === supply.unit ? 1 : supply.purchaseUnits.find((u) => u.name === unitName)?.factor ?? 0;
  const q = parse(f.qty), bad = parse(f.bad) ?? 0, amount = parse(f.amount);
  const good = q && factor ? q * factor - (Number.isNaN(bad) ? 0 : bad) : 0;
  const st = supply ? states.get(supply.id) : undefined;
  const preview = supply && st && good > 0 && amount !== null && !Number.isNaN(amount)
    ? { unit: amount / good, avg: (Math.max(st.stock, 0) * st.avgCost + amount) / (Math.max(st.stock, 0) + good) }
    : null;

  const addSupplier = async () => {
    const name = (newSup ?? "").trim();
    if (!name) return;
    const s: Supplier = { id: newId(), name, origin: "nacional", leadDays: null, contact: "", note: "", archived: false };
    if (await inv.saveSupplier(s)) { setF((x) => ({ ...x, supplierId: s.id })); setNewSup(null); toast(`Proveedor «${name}» creado`); }
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supply) return toast("Elige el insumo");
    if (q === null || Number.isNaN(q) || amount === null || Number.isNaN(amount) || Number.isNaN(bad)) return toast("Revisa cantidad, unidades malas y monto");
    const m = purchaseMovement({ supply, purchaseQty: q, unitName, badQty: bad, amount, supplierId: f.supplierId, day: f.day, note: f.note, receipt: f.receipt || undefined }, { id: newId(), createdAt: new Date().toISOString() });
    if (typeof m === "string") return toast(m);
    setBusy(true);
    const ok = await inv.addMovements([m]);
    setBusy(false);
    if (ok) { toast(`Compra registrada: ${unitsLabel(m.qty, supply.unit)} de ${supply.name}`); onDone(); }
  };

  return (
    <form className="a-card" onSubmit={save} aria-labelledby="pf-h">
      <div className="a-card-h"><h3 className="a-h2" id="pf-h">Registrar compra</h3><button className="a-btn ghost sm" type="button" onClick={onDone} aria-label="Cerrar"><AIClose size="sm" /></button></div>
      {!supplies.length ? <p className="a-cap">Primero crea un insumo en la pestaña Insumos.</p> : <>
        <div className="a-grid2">
          <div className="a-field"><label htmlFor="pf-s">Insumo</label>
            <select id="pf-s" className="a-select" value={f.supplyId} disabled={!!supplyId} onChange={(e) => setF({ ...f, supplyId: e.target.value, unit: "" })}>
              <option value="">Elige un insumo</option>
              {supplies.map((s) => <option key={s.id} value={s.id}>{s.name}{s.category ? ` · ${s.category}` : ""}</option>)}
            </select>
          </div>
          <div className="a-field"><label htmlFor="pf-p">Dónde compraste</label>
            {newSup === null ? (
              <div className="row g2">
                <select id="pf-p" className="a-select" value={f.supplierId} onChange={(e) => setF({ ...f, supplierId: e.target.value })}>
                  <option value="">Sin proveedor</option>
                  {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
                <button className="a-btn sm" type="button" onClick={() => setNewSup("")} style={{ whiteSpace: "nowrap" }}><AIPlus size="sm" />Nuevo</button>
              </div>
            ) : (
              <div className="row g2">
                <input id="pf-p" className="a-input" autoFocus placeholder="Nombre del proveedor" value={newSup} onChange={(e) => setNewSup(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void addSupplier(); } }} />
                <button className="a-btn sm" type="button" onClick={() => void addSupplier()}>Crear</button>
                <button className="a-btn ghost sm" type="button" onClick={() => setNewSup(null)}>Cancelar</button>
              </div>
            )}
          </div>
        </div>
        <div className="a-grid3">
          <div className="a-field"><label htmlFor="pf-q">Cantidad</label><input id="pf-q" className="a-input" inputMode="decimal" value={f.qty} onChange={(e) => setF({ ...f, qty: e.target.value })} placeholder="Ej.: 4" /></div>
          <div className="a-field"><label htmlFor="pf-u">Unidad</label>
            <select id="pf-u" className="a-select" value={unitName} disabled={!supply} onChange={(e) => setF({ ...f, unit: e.target.value })}>
              {supply?.purchaseUnits.map((u) => <option key={u.name} value={u.name}>{u.name} ({unitsLabel(u.factor, supply.unit)})</option>)}
              {supply && <option value={supply.unit}>{supply.unit}</option>}
            </select>
          </div>
          <div className="a-field"><label htmlFor="pf-a">Pagaste en total</label><div className="a-prefix"><span>S/</span><input id="pf-a" inputMode="decimal" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} placeholder="0.00" /></div></div>
        </div>
        <div className="a-grid3">
          <div className="a-field"><label htmlFor="pf-b">Llegaron malas ({supply?.unit ?? "unidades"})</label><input id="pf-b" className="a-input" inputMode="decimal" value={f.bad} onChange={(e) => setF({ ...f, bad: e.target.value })} placeholder="0" /></div>
          <div className="a-field"><label htmlFor="pf-d">Fecha</label><input id="pf-d" className="a-input" type="date" max={today} value={f.day} onChange={(e) => setF({ ...f, day: e.target.value || today })} /></div>
          <div className="a-field"><label htmlFor="pf-n">Nota</label><input id="pf-n" className="a-input" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} placeholder="Opcional" /></div>
        </div>
        <div className="row g2" style={{ flexWrap: "wrap" }}>
          {f.receipt ? <span className="inv-photo"><Thumb src={f.receipt} alt="Boleta" /><button type="button" className="a-btn ghost sm" aria-label="Quitar boleta" onClick={() => setF({ ...f, receipt: "" })}><AIClose size="sm" /></button></span> : null}
          <UploadButton multiple={false} label={f.receipt ? "Cambiar boleta" : "Foto de la boleta (opcional)"} onUploaded={(srcs) => setF((x) => ({ ...x, receipt: srcs[0] ?? x.receipt }))} />
        </div>
        {supply && good > 0 && (
          <p className="a-note" role="status">
            Entran <b>{unitsLabel(good, supply.unit)}</b> buenas
            {preview && <> a <b>{money(preview.unit)}</b> c/u. Costo promedio: {money(st?.avgCost ?? 0)} → <b>{money(preview.avg)}</b> por {supply.unit}.</>}
          </p>
        )}
        <div className="row g2"><button className="a-btn primary" type="submit" disabled={busy}>{busy ? "Guardando…" : "Registrar compra"}</button><button className="a-btn ghost" type="button" onClick={onDone}>Cancelar</button></div>
      </>}
    </form>
  );
}

function PurchasesPanel({ today, states }: { today: string; states: Map<string, SupplyState> }) {
  const { data } = useInventory();
  const inv = useInventory();
  const { toast } = useAdmin();
  const [adding, setAdding] = useState(false);
  const [supplier, setSupplier] = useState("");
  const [supplyQ, setSupplyQ] = useState("");
  const name = (id: string) => data.supplies.find((s) => s.id === id);
  const list = data.movements
    .filter((m) => m.kind === "purchase")
    .filter((m) => !supplier || (supplier === "none" ? !m.supplierId : m.supplierId === supplier))
    .filter((m) => !supplyQ || (name(m.supplyId)?.name ?? "").toLowerCase().includes(supplyQ.toLowerCase()))
    .sort((a, b) => b.day.localeCompare(a.day) || b.createdAt.localeCompare(a.createdAt));
  const spent = list.reduce((n, m) => n + (m.amount ?? 0), 0);

  const remove = async (m: Movement) => {
    if (!window.confirm(`¿Borrar la compra del ${dayLabel(m.day)}? El stock y el costo promedio se recalculan.`)) return;
    if (await inv.deleteMovement(m.id)) toast("Compra borrada");
  };

  return (
    <>
      {adding ? <PurchaseForm today={today} states={states} onDone={() => setAdding(false)} /> : (
        <button className="a-btn primary" type="button" style={{ alignSelf: "flex-start" }} onClick={() => setAdding(true)}><AIPlus size="sm" />Registrar compra</button>
      )}
      <div className="filters-bar">
        <div className="a-search grow"><AISearch size="sm" /><input placeholder="Buscar insumo" aria-label="Buscar compras por insumo" value={supplyQ} onChange={(e) => setSupplyQ(e.target.value)} /></div>
        <select className="a-select" style={{ maxWidth: 220 }} aria-label="Filtrar por proveedor" value={supplier} onChange={(e) => setSupplier(e.target.value)}>
          <option value="">Todos los proveedores</option>
          {data.suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          <option value="none">Sin proveedor</option>
        </select>
      </div>
      <section className="a-card flush" aria-label="Historial de compras">
        <div className="a-card-h"><b>{list.length} {list.length === 1 ? "compra" : "compras"}</b><span className="a-cap">Total: <b className="money">{money(spent)}</b></span></div>
        <div className="a-table">
          {list.map((m) => {
            const s = name(m.supplyId);
            return <MovementRow key={m.id} m={m} unit={s?.unit ?? ""} supplyName={s?.name ?? "Insumo borrado"} supplier={data.suppliers.find((x) => x.id === m.supplierId)?.name ?? "Sin proveedor"} onDelete={() => void remove(m)} />;
          })}
          {!list.length && <p className="a-cap" style={{ padding: "14px 20px" }}>Sin compras registradas.</p>}
        </div>
      </section>
    </>
  );
}

/* ───────────────────────── Proveedores ───────────────────────── */

function SuppliersPanel() {
  const inv = useInventory();
  const { toast } = useAdmin();
  const [edit, setEdit] = useState<Supplier | null>(null);
  const blank: Supplier = { id: "", name: "", origin: "nacional", leadDays: null, contact: "", note: "", archived: false };
  const count = (id: string) => inv.data.movements.filter((m) => m.kind === "purchase" && m.supplierId === id).length;

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!edit) return;
    const name = edit.name.trim();
    if (!name) return toast("Escribe el nombre del proveedor");
    if (inv.data.suppliers.some((s) => s.id !== edit.id && s.name.toLowerCase() === name.toLowerCase())) return toast(`Ya tienes un proveedor llamado «${name}»`);
    const next = { ...edit, id: edit.id || newId(), name };
    if (await inv.saveSupplier(next)) { toast("Proveedor guardado"); setEdit(null); }
  };

  return (
    <>
      {edit ? (
        <form className="a-card" onSubmit={save} aria-labelledby="sp-h">
          <div className="a-card-h"><h3 className="a-h2" id="sp-h">{edit.id ? `Editar ${edit.name}` : "Nuevo proveedor"}</h3><button className="a-btn ghost sm" type="button" onClick={() => setEdit(null)} aria-label="Cerrar"><AIClose size="sm" /></button></div>
          <div className="a-grid2">
            <div className="a-field"><label htmlFor="sp-n">Nombre</label><input id="sp-n" className="a-input" autoFocus value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} placeholder="Ej.: Mercado de flores" /></div>
            <div className="a-field"><label htmlFor="sp-c">Contacto</label><input id="sp-c" className="a-input" value={edit.contact} onChange={(e) => setEdit({ ...edit, contact: e.target.value })} placeholder="Teléfono, puesto o web (opcional)" /></div>
          </div>
          <div className="a-grid2">
            <div className="a-field"><span style={{ fontSize: 13, fontWeight: 600 }}>Origen</span>
              <div className="a-seg" role="radiogroup" aria-label="Origen">
                {(["nacional", "importado"] as const).map((o) => <button key={o} type="button" role="radio" aria-checked={edit.origin === o} className={edit.origin === o ? "on" : ""} onClick={() => setEdit({ ...edit, origin: o })}>{o === "nacional" ? "Nacional" : "Importado"}</button>)}
              </div>
            </div>
            <div className="a-field"><label htmlFor="sp-l">Tiempo de entrega (días)</label><input id="sp-l" className="a-input" inputMode="numeric" value={edit.leadDays ?? ""} onChange={(e) => { const n = parse(e.target.value); setEdit({ ...edit, leadDays: n === null || Number.isNaN(n) ? null : Math.max(0, Math.round(n)) }); }} placeholder="0 = el mismo día" /></div>
          </div>
          <div className="a-field"><label htmlFor="sp-no">Nota</label><input id="sp-no" className="a-input" value={edit.note} onChange={(e) => setEdit({ ...edit, note: e.target.value })} placeholder="Opcional" /></div>
          <div className="row g2"><button className="a-btn primary" type="submit">Guardar</button><button className="a-btn ghost" type="button" onClick={() => setEdit(null)}>Cancelar</button></div>
        </form>
      ) : <button className="a-btn primary" type="button" style={{ alignSelf: "flex-start" }} onClick={() => setEdit(blank)}><AIPlus size="sm" />Nuevo proveedor</button>}
      <section className="a-card flush" aria-label="Proveedores">
        <div className="a-table">
          {inv.data.suppliers.filter((s) => !s.archived).map((s) => (
            <button key={s.id} type="button" className="a-tr inv-row" style={{ gridTemplateColumns: "minmax(0, 1fr) 120px 150px 100px" }} onClick={() => setEdit(s)}>
              <span className="stack" style={{ gap: 1, textAlign: "left" }}><b>{s.name}</b>{(s.contact || s.note) && <span className="a-cap">{[s.contact, s.note].filter(Boolean).join(" · ")}</span>}<span className="c-m a-cap">{s.origin === "importado" ? "Importado" : "Nacional"}{s.leadDays !== null ? ` · ${s.leadDays === 0 ? "entrega el mismo día" : `${s.leadDays} días`}` : ""} · {count(s.id)} compras</span></span>
              <span className="c-d"><span className={`st ${s.origin === "importado" ? "pend" : "publicado"}`}>{s.origin === "importado" ? "Importado" : "Nacional"}</span></span>
              <span className="c-d a-cap">{s.leadDays === null ? "—" : s.leadDays === 0 ? "El mismo día" : `${s.leadDays} días`}</span>
              <span className="c-d a-cap">{count(s.id)} compras</span>
            </button>
          ))}
          {!inv.data.suppliers.some((s) => !s.archived) && <p className="a-cap" style={{ padding: "14px 20px" }}>Todavía no tienes proveedores. También puedes crearlos al registrar una compra.</p>}
        </div>
      </section>
    </>
  );
}
