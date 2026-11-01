"use client";

/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { useState } from "react";
import { asset } from "@/lib/assets";
import { moneyShort, money } from "@/lib/admin/format";
import { dataKey, usePersisted } from "@/lib/admin/storage";
import { useAdmin, useAdminCatalog } from "../AdminContext";
import { AdminPage, DemoNote } from "../AdminPage";

export type ManualSale = { id: string; date: string; channel: string; client: string; pay: string; lines: { productId: string; variantId: string; qty: number; price: number }[]; dIn: number; dOut: number; note: string };
export const CHANNELS: [string, string][] = [["web", "Web"], ["ig", "Instagram"], ["feria", "Ferias"], ["otros", "Otros"]];

export function useManualSales() {
  const { bundle } = useAdmin();
  return usePersisted<ManualSale[]>(dataKey(bundle.tenant.slug, "sales"), []);
}

export function SalesView() {
  const { bundle, demo, toast } = useAdmin();
  const { catalog } = useAdminCatalog();
  const [manual] = useManualSales();
  const [period, setPeriod] = useState<"mes" | "tri" | "ano">("mes");
  const [line, setLine] = useState("all");
  const [chan, setChan] = useState("all");
  const [rank, setRank] = useState<"c" | "u">("c");
  const scale = period === "mes" ? 1 : period === "tri" ? 2.6 : 7.4;
  const prod = (id: string) => catalog.products.find((p) => p.id === id);
  const price = (pid: string, vid: string) => prod(pid)?.variants.find((v) => v.id === vid)?.price ?? 0;
  const cost = (pid: string, vid: string) => catalog.costs[pid]?.[vid] ?? 0;

  const base = demo.sales.lines.map(([pid, vid, ch, u, dIn, dOut, o]) => {
    const units = Math.max(1, Math.round(u * scale));
    return { pid, ch, line: prod(pid)?.line ?? "", units, rev: price(pid, vid) * units, cost: cost(pid, vid) * units, dIn: dIn * scale, dOut: dOut * scale, orders: Math.max(1, Math.round(o * scale)) };
  });
  const extra = manual.flatMap((s) => s.lines.map((l, i) => ({ pid: l.productId, ch: s.channel, line: prod(l.productId)?.line ?? "", units: l.qty, rev: l.price * l.qty, cost: cost(l.productId, l.variantId) * l.qty, dIn: i ? 0 : s.dIn, dOut: i ? 0 : s.dOut, orders: i ? 0 : 1 })));
  const rows = [...base, ...extra];
  const byLine = rows.filter((r) => line === "all" || r.line === line);
  const f = byLine.filter((r) => chan === "all" || r.ch === chan);
  const sum = <K extends "rev" | "cost" | "units" | "orders" | "dIn" | "dOut">(arr: typeof rows, k: K) => arr.reduce((a, r) => a + r[k], 0);
  const rev = sum(f, "rev"), cst = sum(f, "cost"), units = sum(f, "units"), orders = sum(f, "orders"), del = sum(f, "dIn") - sum(f, "dOut");

  const chanAgg = CHANNELS.map(([k, label]) => { const a = byLine.filter((r) => r.ch === k); return { k, label, rev: sum(a, "rev"), contrib: sum(a, "rev") - sum(a, "cost"), units: sum(a, "units") }; });
  const maxRev = Math.max(1, ...chanAgg.map((c) => c.rev));
  const prodAgg = catalog.products.map((p) => { const a = f.filter((r) => r.pid === p.id); return { p, units: sum(a, "units"), contrib: sum(a, "rev") - sum(a, "cost") }; }).filter((x) => x.units > 0);
  prodAgg.sort((a, b) => (rank === "c" ? b.contrib - a.contrib : b.units - a.units));
  const top = prodAgg.slice(0, 5);
  const maxK = Math.max(1, ...top.map((x) => (rank === "c" ? x.contrib : x.units)));
  const fr = byLine.filter((r) => r.ch === "feria");
  const fRev = sum(fr, "rev"), fCon = fRev - sum(fr, "cost");
  const fixed = demo.sales.fair.fixedCosts.reduce((a, c) => a + c.amount, 0);
  const fNet = fCon - fixed;
  const chanName = (k: string) => CHANNELS.find((c) => c[0] === k)?.[1] ?? k;
  const recent = [
    ...manual.slice().reverse().map((s) => {
      const r = s.lines.reduce((a, l) => a + l.price * l.qty, 0);
      const c = s.lines.reduce((a, l) => a + cost(l.productId, l.variantId) * l.qty, 0);
      return { date: s.date, detail: s.lines.map((l) => `${prod(l.productId)?.name ?? l.productId} x${l.qty}`).join(" + "), note: s.note, channel: s.channel, revenue: r + s.dIn, contribution: r - c + s.dIn - s.dOut };
    }),
    ...demo.sales.recent,
  ];

  return (
    <AdminPage title="Ventas" topRight={<Link className="a-btn primary sm" href="/admin/ventas/nueva">+ Venta</Link>}>
      <div className="a-head">
        <div className="stack g1"><h1 className="a-h1">Ventas y márgenes</h1><p className="a-sub">Todos los canales en un solo lugar. Montos aproximados según los costos cargados.</p></div>
        <div className="row g2 wrap-row"><button className="a-btn" type="button" onClick={() => toast("Exportar CSV llega con la Fase 3")}>Exportar CSV</button><Link className="a-btn primary only-d" href="/admin/ventas/nueva">+ Registrar venta</Link></div>
      </div>
      <div className="row g3 wrap-row">
        <div className="a-seg" role="group" aria-label="Período">
          {([["mes", "Octubre"], ["tri", "Trimestre"], ["ano", "2026"]] as const).map(([k, l]) => <button key={k} className={period === k ? "on" : ""} type="button" aria-pressed={period === k} onClick={() => setPeriod(k)}>{l}</button>)}
        </div>
        <select className="a-select" style={{ width: "auto", minWidth: 200 }} value={line} onChange={(e) => setLine(e.target.value)} aria-label="Línea">
          <option value="all">Todas las líneas</option>
          {catalog.lines.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
      </div>
      <div className="a-scroll-x" role="group" aria-label="Canal">
        {[["all", "Todos los canales"], ...CHANNELS].map(([k, l]) => <button key={k} className={`a-chip ${chan === k ? "on" : ""}`} type="button" aria-pressed={chan === k} onClick={() => setChan(k)}>{l}</button>)}
      </div>
      <div className="kpis5">
        <div className="kpi"><span className="l">Ingresos</span><span className="v money">{moneyShort(rev)}</span><span className="a-cap">{orders} ventas</span></div>
        <div className="kpi"><span className="l">Costo de productos</span><span className="v money">{moneyShort(cst)}</span><span className="a-cap">Según costo por variante</span></div>
        <div className="kpi"><span className="l">Contribución</span><span className="v money">{moneyShort(rev - cst)}</span><span className="a-cap">Margen {rev ? Math.round(((rev - cst) / rev) * 100) : 0}%</span></div>
        <div className="kpi"><span className="l">Unidades</span><span className="v">{units}</span><span className="a-cap">Ticket prom. {orders ? moneyShort(rev / orders) : "—"}</span></div>
        <div className="kpi"><span className="l">Resultado delivery</span><span className="v money" style={{ color: del >= 0 ? "#1F6B35" : "#B42318" }}>{del >= 0 ? "+ " : "− "}{moneyShort(Math.abs(del))}</span><span className="a-cap">Cobrado {moneyShort(sum(f, "dIn"))} · costó {moneyShort(sum(f, "dOut"))}</span></div>
      </div>
      <div className="a-cols even">
        <section className="a-card" aria-labelledby="v-ch">
          <div className="a-card-h"><h2 className="a-h2" id="v-ch">Por canal</h2><div className="legend"><span><i style={{ background: "#C9CFC3" }} />Ingresos</span><span><i style={{ background: "#1F2A22" }} />Contribución</span></div></div>
          {chanAgg.map((c) => (
            <div className="chbar" key={c.k}>
              <span><b>{c.label}</b><br /><span className="a-cap">{c.units} u.</span></span>
              <div className="track" role="img" aria-label={`${c.label}: ingresos ${moneyShort(c.rev)}, contribución ${moneyShort(c.contrib)}`}><i style={{ width: `${(c.rev / maxRev) * 100}%` }} /><b style={{ width: `${(Math.max(0, c.contrib) / maxRev) * 100}%` }} /></div>
              <span className="money" style={{ textAlign: "right" }}><b>{moneyShort(c.rev)}</b><br /><span className="a-cap">{moneyShort(c.contrib)}</span></span>
            </div>
          ))}
        </section>
        <section className="a-card" aria-labelledby="v-rk">
          <div className="a-card-h"><h2 className="a-h2" id="v-rk">Ranking de productos</h2>
            <div className="a-seg" role="group" aria-label="Ordenar ranking"><button className={rank === "c" ? "on" : ""} type="button" aria-pressed={rank === "c"} onClick={() => setRank("c")}>Top contribución</button><button className={rank === "u" ? "on" : ""} type="button" aria-pressed={rank === "u"} onClick={() => setRank("u")}>Top unidades</button></div>
          </div>
          <div>
            {top.map((x, i) => (
              <div className="rk" key={x.p.id}>
                <span className="n">{i + 1}</span>
                <span className="av" style={{ width: 44, height: 44 }}><img src={asset(bundle.tenant.slug, x.p.images[0])} alt="" /></span>
                <div><b>{x.p.name}</b><span className="a-cap"> · {catalog.lines.find((l) => l.id === x.p.line)?.name}</span><div className="bar"><i style={{ width: `${((rank === "c" ? x.contrib : x.units) / maxK) * 100}%` }} /></div></div>
                <span className="money" style={{ textAlign: "right" }}><b>{rank === "c" ? moneyShort(x.contrib) : `${x.units} u.`}</b><br /><span className="a-cap">{rank === "c" ? `${x.units} u.` : moneyShort(x.contrib)}</span></span>
              </div>
            ))}
          </div>
        </section>
      </div>
      <section className="a-card" aria-labelledby="v-fair">
        <div className="a-card-h" style={{ flexWrap: "wrap" }}><div className="stack g1"><h2 className="a-h2" id="v-fair">Ferias y eventos</h2><p className="a-cap">Para decidir si volver el próximo año.</p></div></div>
        <div className="row between wrap-row g2"><div><b>{demo.sales.fair.name}</b><p className="a-cap">{demo.sales.fair.dates}</p></div><span className={fNet > 0 ? "ok-pill" : "bad-pill"}>{fNet > 0 ? "Rentable · conviene volver" : "No cubrió costos"}</span></div>
        <div className="fair">
          <div><span className="a-cap">Ventas</span><b className="money">{moneyShort(fRev)}</b><span className="a-cap">{sum(fr, "units")} unidades</span></div>
          <div><span className="a-cap">Contribución de productos</span><b className="money">{moneyShort(fCon)}</b><span className="a-cap">Margen {fRev ? Math.round((fCon / fRev) * 100) : 0}%</span></div>
          <div><span className="a-cap">Costos fijos</span><b className="money">− {moneyShort(fixed)}</b><span className="a-cap">{demo.sales.fair.fixedCosts.map((c) => `${c.label} ${moneyShort(c.amount)}`).join(" · ")}</span></div>
          <div style={{ background: "#E4F2E7" }}><span className="a-cap">Contribución neta</span><b className="money">{fNet < 0 ? "− " : ""}{moneyShort(Math.abs(fNet))}</b><span className="a-cap">{moneyShort(fNet / demo.sales.fair.days)} por día</span></div>
        </div>
      </section>
      <section className="a-card flush" aria-labelledby="v-rec">
        <div className="a-card-h"><h2 className="a-h2" id="v-rec">Últimas ventas registradas</h2><Link className="a-btn sm ghost" href="/admin/ventas/nueva">+ Registrar</Link></div>
        <div className="a-table">
          <div className="a-tr head" style={{ gridTemplateColumns: "110px minmax(0, 1.4fr) 150px 110px 110px" }}><span>Fecha</span><span>Detalle</span><span>Canal</span><span>Ingreso</span><span>Contribución</span></div>
          {recent.map((r, i) => (
            <div key={i} className="a-tr" style={{ gridTemplateColumns: "110px minmax(0, 1.4fr) 150px 110px 110px" }}>
              <span className="c-d">{r.date}</span>
              <span className="stack"><b>{r.detail}</b><span className="a-cap">{r.note}</span><span className="c-m a-cap">{r.date} · {chanName(r.channel)}</span></span>
              <span className="c-d"><span className="st nuevo">{chanName(r.channel)}</span></span>
              <span className="money" style={{ fontWeight: 700 }}>{money(r.revenue)}</span>
              <span className="c-d money delta-zero">{money(r.contribution)}</span>
            </div>
          ))}
        </div>
      </section>
      <DemoNote>Ventas de ejemplo. Los precios con «referencial» aún no están confirmados por la marca.</DemoNote>
    </AdminPage>
  );
}
