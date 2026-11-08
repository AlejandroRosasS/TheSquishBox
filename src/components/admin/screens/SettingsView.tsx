"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { dataKey, usePersisted } from "@/lib/admin/storage";
import { useAdmin } from "../AdminContext";
import { AdminPage, DemoNote, Switch } from "../AdminPage";
import { AIChevron, AIInstagram } from "../AdminIcons";
import { CulqiSettings } from "../CulqiSettings";
import { PaymentFeesPanel } from "./PaymentFeesPanel";
import { useInventory } from "../AdminInventory";
import { useToday } from "@/lib/useToday";
import { useTextsDraft } from "./useTextsDraft";
import { businessOf, isPlaceholder } from "@/lib/legal";

type Rate = { name: string; fee: string; cost: string; on: boolean };
type Settings = { rates: Rate[]; pickup: { on: boolean; point: string; hours: string } };

const TABS = [
  { id: "empresa", label: "Datos de empresa" },
  { id: "conexiones", label: "Conexiones" },
  { id: "delivery", label: "Tarifas de delivery" },
  { id: "pagos", label: "Comisiones e IGV" },
  { id: "modulos", label: "Módulos" },
] as const;
type TabId = (typeof TABS)[number]["id"];
const isTab = (v: string): v is TabId => TABS.some((t) => t.id === v);

export function SettingsView() {
  const { bundle, demo } = useAdmin();
  const { tenant, storefront } = bundle;
  // Lo publicado (o el borrador) de Textos, para mostrar los datos de la empresa al día.
  const { bundle: live } = useTextsDraft();
  const biz = businessOf(tenant, live.storefront);
  const initial: Settings = useMemo(
    () => ({
      rates: Object.entries(storefront.checkout.deliveryRates).map(([name, fee]) => ({ name, fee: fee === null ? "" : String(fee), cost: demo.deliveryCosts[name] !== undefined ? String(demo.deliveryCosts[name]) : "", on: fee !== null })),
      pickup: { on: true, point: "", hours: "" },
    }),
    [storefront, demo],
  );
  const [s, setS] = usePersisted<Settings>(dataKey(tenant.slug, "settings"), initial);
  const [newD, setNewD] = useState<string | null>(null);
  // Tab activo: se refleja en el hash (#delivery) para poder enlazarlo y volver con «Atrás».
  const [tab, setTab] = useState<TabId>("empresa");
  const tabRefs = useRef<Record<TabId, HTMLButtonElement | null>>({ empresa: null, conexiones: null, delivery: null, pagos: null, modulos: null });
  useEffect(() => {
    const sync = () => { const h = window.location.hash.slice(1); if (isTab(h)) setTab(h); };
    sync();
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);
  const pick = (id: TabId, focus = false) => {
    setTab(id);
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
  const setRate = (i: number, patch: Partial<Rate>) => setS((x) => ({ ...x, rates: x.rates.map((r, j) => (j === i ? { ...r, ...patch } : r)) }));

  const inv = useInventory();
  // El estado del inventario se conoce recién en el navegador: el interruptor se activa después de hidratar.
  const mounted = !!useToday();
  const more = [
    ...(mounted && inv.data.enabled ? [{ href: "/admin/inventario", label: "Inventario" }] : []),
    { href: "/admin/apariencia", label: "Apariencia de la tienda" },
    { href: "/admin/textos", label: "Textos de la tienda" },
    { href: "/admin/seo", label: "SEO y redes" },
    { href: "/admin/notificaciones", label: "Notificaciones" },
    { href: "/admin/reclamaciones", label: "Libro de reclamaciones" },
    { href: "/admin/ventas", label: "Ventas y márgenes" },
  ];

  return (
    <AdminPage title="Ajustes">
      <div className="a-head"><div className="stack g1"><h1 className="a-h1">Ajustes</h1><p className="a-sub">Datos de la empresa, conexiones, tarifas de delivery, comisiones e IGV, y módulos.</p></div></div>
      <nav className="only-m stack g2" aria-label="Más secciones">
        {more.map((m) => <Link key={m.href} className="a-btn block" href={m.href} style={{ justifyContent: "space-between" }}>{m.label}<AIChevron size="sm" /></Link>)}
      </nav>

      <div className="a-seg a-tabs" role="tablist" aria-label="Secciones de ajustes" onKeyDown={onTabKey}>
        {TABS.map((t) => (
          <button key={t.id} ref={(el) => { tabRefs.current[t.id] = el; }} id={`aj-tab-${t.id}`} type="button" role="tab" className={tab === t.id ? "on" : ""} aria-selected={tab === t.id} aria-controls={`aj-panel-${t.id}`} tabIndex={tab === t.id ? 0 : -1} onClick={() => pick(t.id)}>{t.label}</button>
        ))}
      </div>
      <div role="tabpanel" id="aj-panel-empresa" aria-labelledby="aj-tab-empresa" hidden={tab !== "empresa"}>
        <section className="a-card" aria-labelledby="aj-store">
          <h2 className="a-h2" id="aj-store">Datos de la empresa</h2>
          <p className="a-cap">Se muestran en el pie de la tienda, Contacto, Términos y el Libro de reclamaciones (lo que pide Culqi e INDECOPI).</p>
          {([["Razón social", biz.legalName], ["RUC", biz.ruc], ["Dirección", biz.address], ["Correo", biz.email], ["WhatsApp", biz.phone]] as const).map(([k, v]) => (
            <div key={k} className="row between g3"><span className="a-cap">{k}</span>{isPlaceholder(v) ? <span className="st pend">Falta</span> : <b style={{ textAlign: "right", overflowWrap: "anywhere" }}>{v}</b>}</div>
          ))}
          <Link className="a-btn" href="/admin/textos" style={{ alignSelf: "flex-start" }}>Editar en Textos › Empresa y contacto</Link>
        </section>
      </div>
      <div role="tabpanel" id="aj-panel-conexiones" aria-labelledby="aj-tab-conexiones" hidden={tab !== "conexiones"}>
        <section className="a-card" aria-labelledby="aj-con">
          <h2 className="a-h2" id="aj-con">Conexiones</h2>
          <div className="row g3"><span className="ch-ico"><AIInstagram /></span><div className="grow"><b>Instagram</b><p className="a-cap">@{tenant.instagram} · sincroniza cada 15 min</p></div><span className="st pagado">Conectado</span></div>
          <CulqiSettings />
        </section>
      </div>
      <div role="tabpanel" id="aj-panel-delivery" aria-labelledby="aj-tab-delivery" hidden={tab !== "delivery"}>
        <section className="a-card flush" aria-labelledby="aj-rates">
          <div className="a-card-h" style={{ flexWrap: "wrap" }}>
            <div className="stack g1"><h2 className="a-h2" id="aj-rates">Tarifas de delivery</h2><p className="a-cap">Lo que cobras (estimado) y lo que te cuesta en promedio. Los distritos inactivos muestran «A coordinar».{storefront.checkout.deliveryRatesAreExample ? " Tarifas de ejemplo: confírmalas." : ""}</p></div>
            <button className="a-btn sm" type="button" onClick={() => setNewD("")}>+ Agregar distrito</button>
          </div>
          {newD !== null && (
            <form className="row g2" style={{ padding: "12px 20px", borderBottom: "1px solid var(--a-border)" }} onSubmit={(e) => { e.preventDefault(); if (newD.trim()) { setS((x) => ({ ...x, rates: [...x.rates, { name: newD.trim(), fee: "", cost: "", on: true }] })); setNewD(null); } }}>
              <input className="a-input" autoFocus aria-label="Nombre del distrito" placeholder="Distrito" value={newD} onChange={(e) => setNewD(e.target.value)} />
              <button className="a-btn primary sm" type="submit">Agregar</button><button className="a-btn ghost sm" type="button" onClick={() => setNewD(null)}>Cancelar</button>
            </form>
          )}
          <div className="rate head"><span>Distrito</span><span>Cobro al cliente</span><span>Costo promedio</span><span>Margen</span><span>Activo</span></div>
          {s.rates.map((r, i) => {
            const fee = parseFloat(r.fee), cost = parseFloat(r.cost);
            const has = Number.isFinite(fee) && Number.isFinite(cost);
            const m = has ? fee - cost : 0;
            return (
              <div key={r.name} className={`rate ${r.on ? "" : "off"}`}>
                <b className="nm">{r.name}</b>
                <div><span className="m-lbl">Cobro</span><div className="a-prefix"><span>S/</span><input inputMode="decimal" value={r.fee} onChange={(e) => setRate(i, { fee: e.target.value })} aria-label={`Cobro ${r.name}`} /></div></div>
                <div><span className="m-lbl">Costo</span><div className="a-prefix"><span>S/</span><input inputMode="decimal" value={r.cost} onChange={(e) => setRate(i, { cost: e.target.value })} aria-label={`Costo ${r.name}`} /></div></div>
                <span className="mg a-cap" style={{ fontWeight: 700, color: m >= 0 ? "#1F6B35" : "#B42318" }}>{!r.on ? "A coordinar" : has ? `${m >= 0 ? "+" : "−"} S/ ${Math.abs(m)}` : "—"}</span>
                <span className="swc"><Switch on={r.on} onChange={(v) => setRate(i, { on: v })} label={`Activo ${r.name}`} /></span>
              </div>
            );
          })}
          <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 12, background: "#FAFAF8" }}>
            <div className="row between"><div><b>Recojo en punto de entrega acordado</b><p className="a-cap">Gratis para el cliente · se coordina por WhatsApp</p></div><Switch on={s.pickup.on} onChange={(v) => setS((x) => ({ ...x, pickup: { ...x.pickup, on: v } }))} label="Recojo activo" /></div>
            <div className="a-grid2">
              <div className="a-field"><label htmlFor="t-dir">Punto de entrega</label><input id="t-dir" className="a-input" placeholder="[Punto de entrega, ej.: estación o centro comercial]" value={s.pickup.point} onChange={(e) => setS((x) => ({ ...x, pickup: { ...x.pickup, point: e.target.value } }))} /></div>
              <div className="a-field"><label htmlFor="t-hor">Horario de recojo</label><input id="t-hor" className="a-input" placeholder="Ej.: lun a sáb, 10 a. m. – 6 p. m." value={s.pickup.hours} onChange={(e) => setS((x) => ({ ...x, pickup: { ...x.pickup, hours: e.target.value } }))} /></div>
            </div>
          </div>
        </section>
      </div>
      <div role="tabpanel" id="aj-panel-pagos" aria-labelledby="aj-tab-pagos" hidden={tab !== "pagos"}>
        <PaymentFeesPanel />
      </div>
      <div role="tabpanel" id="aj-panel-modulos" aria-labelledby="aj-tab-modulos" hidden={tab !== "modulos"}>
        <section className="a-card" aria-labelledby="aj-mod">
          <h2 className="a-h2" id="aj-mod">Módulos</h2>
          <div className="row between g3">
            <div className="grow">
              <b>Inventario de insumos</b>
              <p className="a-cap">Insumos con fotos, compras por proveedor, último costo y costo promedio. Agrega «Inventario» al menú. No cambia el stock que ve el cliente en la tienda.</p>
              {mounted && !inv.available && <p className="a-cap">Falta la migración 0011_inventory en Supabase.</p>}
            </div>
            <Switch on={mounted && inv.data.enabled} disabled={!mounted || !inv.hydrated || !inv.available} onChange={(v) => void inv.setEnabled(v)} label="Inventario de insumos" />
          </div>
          {mounted && inv.data.enabled && <Link className="a-btn" href="/admin/inventario" style={{ alignSelf: "flex-start" }}>Ir a Inventario</Link>}
        </section>
      </div>
      <DemoNote>Demo: los ajustes se guardan en este navegador. En la Fase 3 las tarifas pasan a la tienda en vivo.</DemoNote>
    </AdminPage>
  );
}
