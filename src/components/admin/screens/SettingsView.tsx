"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { dataKey, usePersisted } from "@/lib/admin/storage";
import { useAdmin, useAdminCatalog } from "../AdminContext";
import { AdminPage, DemoNote, Switch } from "../AdminPage";
import { AIChevron, AIBox, AIInstagram } from "../AdminIcons";
import { CulqiSettings } from "../CulqiSettings";

type Rate = { name: string; fee: string; cost: string; on: boolean };
type Settings = { rates: Rate[]; pickup: { on: boolean; point: string; hours: string }; store: { name: string; ruc: string; whatsapp: string; email: string } };

export function SettingsView() {
  const { bundle, demo, toast } = useAdmin();
  const { tenant, storefront } = bundle;
  const { catalog } = useAdminCatalog();
  const initial: Settings = useMemo(
    () => ({
      rates: Object.entries(storefront.checkout.deliveryRates).map(([name, fee]) => ({ name, fee: fee === null ? "" : String(fee), cost: demo.deliveryCosts[name] !== undefined ? String(demo.deliveryCosts[name]) : "", on: fee !== null })),
      pickup: { on: true, point: "", hours: "" },
      store: { name: tenant.name, ruc: "", whatsapp: /x/i.test(tenant.whatsapp) ? "" : tenant.whatsapp, email: "" },
    }),
    [storefront, demo, tenant],
  );
  const [s, setS] = usePersisted<Settings>(dataKey(tenant.slug, "settings"), initial);
  const [newD, setNewD] = useState<string | null>(null);
  const setRate = (i: number, patch: Partial<Rate>) => setS((x) => ({ ...x, rates: x.rates.map((r, j) => (j === i ? { ...r, ...patch } : r)) }));

  const more = [
    { href: "/admin/apariencia", label: "Apariencia de la tienda" },
    { href: "/admin/textos", label: "Textos de la tienda" },
    { href: "/admin/seo", label: "SEO y redes" },
    { href: "/admin/notificaciones", label: "Notificaciones" },
    { href: "/admin/ventas", label: "Ventas y márgenes" },
  ];

  return (
    <AdminPage title="Ajustes">
      <div className="a-head"><div className="stack g1"><h1 className="a-h1">Ajustes</h1><p className="a-sub">Datos de la tienda, conexiones y tarifas de delivery.</p></div></div>
      <nav className="only-m stack g2" aria-label="Más secciones">
        {more.map((m) => <Link key={m.href} className="a-btn block" href={m.href} style={{ justifyContent: "space-between" }}>{m.label}<AIChevron size="sm" /></Link>)}
      </nav>

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

      <div className="a-cols even">
        <section className="a-card" aria-labelledby="aj-store">
          <h2 className="a-h2" id="aj-store">Datos de la tienda</h2>
          <div className="a-field"><label htmlFor="s-n">Nombre</label><input id="s-n" className="a-input" value={s.store.name} onChange={(e) => setS((x) => ({ ...x, store: { ...x.store, name: e.target.value } }))} /></div>
          <div className="a-grid2">
            <div className="a-field"><label htmlFor="s-ruc">RUC</label><input id="s-ruc" className="a-input" inputMode="numeric" placeholder="[RUC]" value={s.store.ruc} onChange={(e) => setS((x) => ({ ...x, store: { ...x.store, ruc: e.target.value } }))} /></div>
            <div className="a-field"><label htmlFor="s-wa">WhatsApp de atención</label><input id="s-wa" className="a-input" inputMode="tel" placeholder={tenant.whatsapp} value={s.store.whatsapp} onChange={(e) => setS((x) => ({ ...x, store: { ...x.store, whatsapp: e.target.value } }))} /></div>
          </div>
          <div className="a-field"><label htmlFor="s-mail">Correo</label><input id="s-mail" className="a-input" type="email" placeholder={`hola@${tenant.domain}`} value={s.store.email} onChange={(e) => setS((x) => ({ ...x, store: { ...x.store, email: e.target.value } }))} /></div>
          <button className="a-btn primary" type="button" style={{ alignSelf: "flex-start" }} onClick={() => toast("Ajustes guardados")}>Guardar</button>
        </section>
        <section className="a-card" aria-labelledby="aj-con">
          <h2 className="a-h2" id="aj-con">Conexiones</h2>
          <div className="row g3"><span className="ch-ico"><AIInstagram /></span><div className="grow"><b>Instagram</b><p className="a-cap">@{tenant.instagram} · sincroniza cada 15 min</p></div><span className="st pagado">Conectado</span></div>
          <CulqiSettings />
          <div className="row g3"><span className="ch-ico"><AIBox /></span><div className="grow"><b>Líneas</b><p className="a-cap">{catalog.lines.length} líneas ({catalog.lines.map((l) => l.name).join(", ")}) · se ordenan desde Productos</p></div><Link className="a-btn sm" href="/admin/productos">Ordenar</Link></div>
        </section>
      </div>
      <DemoNote>Demo: los ajustes se guardan en este navegador. En la Fase 3 las tarifas pasan a la tienda en vivo.</DemoNote>
    </AdminPage>
  );
}
