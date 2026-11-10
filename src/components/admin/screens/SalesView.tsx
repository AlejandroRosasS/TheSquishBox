"use client";

/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { useEffect, useState } from "react";
import { asset } from "@/lib/assets";
import { moneyShort, money } from "@/lib/admin/format";
import { useAdmin, useAdminCatalog, useOrders } from "../AdminContext";
import { useOrdersFromDb } from "../AdminOrders";
import { useCampaigns } from "../AdminCampaigns";
import { CAMPAIGN_STATE, campaignRange, campaignState } from "@/lib/campaigns";
import { AdminPage, DemoNote } from "../AdminPage";
import { limaToday, useManualSales, type ManualSale } from "../AdminSales";
import { salesToCsv, type ExportSale } from "@/lib/sales/csv";
import { deductions, feesConfigured, payMethodKey } from "@/lib/sales/fees";
import { usePaymentFees } from "../AdminFees";
import { fairOn } from "@/lib/fairs";
import { useFairs } from "../AdminFairs";
import { FairsSection } from "./FairsSection";

export const CHANNELS: [string, string][] = [["web", "Web"], ["ig", "Instagram"], ["feria", "Ferias"], ["otros", "Otros"]];

const CAMP_COLS = "minmax(0, 1.4fr) minmax(0, 1.2fr) 80px 100px 100px 110px";

/** Texto bajo cada venta: medio de pago, delivery, cliente y nota. */
function saleCaption(s: ManualSale, money: (n: number) => string) {
  if (!s.day) return s.note; // guardadas antes en el navegador: la nota ya traía todo
  return [s.pay, s.dIn ? `delivery ${money(s.dIn)}` : "sin delivery", s.client, s.note].filter(Boolean).join(" · ");
}

/** Descarga un texto como archivo (CSV con BOM para que Excel lea bien las tildes). */
export function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob(["\uFEFF", text], { type: "text/csv;charset=utf-8" }));
  const a = Object.assign(document.createElement("a"), { href: url, download: name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function SalesView() {
  const { bundle, demo, toast } = useAdmin();
  const { catalog } = useAdminCatalog();
  const { sales: manual } = useManualSales();
  const [period, setPeriod] = useState<"mes" | "tri" | "ano">("mes");
  const [line, setLine] = useState("all");
  const [chan, setChan] = useState("all");
  const [rank, setRank] = useState<"c" | "u">("c");
  const [campF, setCampF] = useState("all");
  const { campaigns } = useCampaigns();
  const { fairs } = useFairs();
  const fromDb = useOrdersFromDb();
  const { orders: dbOrders } = useOrders();
  const { fees } = usePaymentFees();
  const [now, setNow] = useState<number | null>(null);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- la hora es solo del navegador
  useEffect(() => setNow(Date.now()), []);
  const scale = period === "mes" ? 1 : period === "tri" ? 2.6 : 7.4;
  const prod = (id: string) => catalog.products.find((p) => p.id === id);
  const sum = <K extends "rev" | "listRev" | "cost" | "units" | "orders" | "dIn" | "dOut" | "igv" | "fee" | "dCut">(arr: { [k in K]: number }[], k: K) => arr.reduce((a, r) => a + r[k], 0);
  const price = (pid: string, vid: string) => prod(pid)?.variants.find((v) => v.id === vid)?.price ?? 0;
  const cost = (pid: string, vid: string) => catalog.costs[pid]?.[vid] ?? 0;

  const base = demo.sales.lines.map(([pid, vid, ch, u, dIn, dOut, o]) => {
    const units = Math.max(1, Math.round(u * scale));
    const rev = price(pid, vid) * units;
    return { pid, ch, line: prod(pid)?.line ?? "", units, rev, listRev: rev, cost: cost(pid, vid) * units, dIn: dIn * scale, dOut: dOut * scale, orders: Math.max(1, Math.round(o * scale)), camp: "", campName: "", igv: 0, fee: 0, dCut: 0, card: false, fair: "" as string | null };
  });
  type Row = (typeof base)[number];
  // IGV y comisión según el medio de pago (Ajustes › Comisiones e IGV). Lo del delivery cobrado se descuenta del resultado del delivery;
  // el fijo por operación, de los productos (una vez por venta).
  const saleLine = (l: ManualSale["lines"][number], ch: string, first: boolean, dIn: number, dOut: number, pay: string | undefined): Row => {
    const key = payMethodKey(pay, ch);
    const rule = key ? fees.rules[key] : null;
    const rev = l.price * l.qty;
    const d = deductions(rev, rule, fees.igvRate, first);
    const dd = first ? deductions(dIn, rule, fees.igvRate, false) : { igv: 0, fee: 0 };
    return {
      pid: l.productId, ch, line: prod(l.productId)?.line ?? "", units: l.qty, rev, listRev: (l.listPrice ?? l.price) * l.qty,
      cost: (l.cost ?? cost(l.productId, l.variantId)) * l.qty, dIn: first ? dIn : 0, dOut: first ? dOut : 0, orders: first ? 1 : 0, camp: l.campaignId ?? "", campName: l.campaign ?? "",
      igv: d.igv, fee: d.fee, dCut: dd.igv + dd.fee, card: key === "card_web" || key === "card_pos", fair: null,
    };
  };
  // Ventas de feria: se cargan en la feria vigente ese día (misma regla que la base). "" = ninguna.
  const fairOf = (s: ManualSale) => (s.channel === "feria" ? fairOn(fairs, s.day)?.id ?? "" : null);
  const extra = manual.flatMap((s) => s.lines.map((l, i) => ({ ...saleLine(l, s.channel, !i, s.dIn, s.dOut, s.pay), fair: fairOf(s) })));
  // Pedidos reales de la web (con la base): los cancelados, fallidos o devueltos no cuentan.
  const web = fromDb
    ? dbOrders
        .filter((o) => o.status !== "cancelado" && !["failed", "refunded"].includes(o.paymentStatus ?? ""))
        .flatMap((o) => o.lines.map((l, i) => saleLine(l, "web", !i, o.deliveryFee, o.deliveryReal ?? o.deliveryFee, o.payMethod)))
    : [];
  const rows = [...base, ...extra, ...web];
  /** Contribución = ingresos − costo de productos − IGV − comisiones. */
  const contrib = (a: Row[]) => sum(a, "rev") - sum(a, "cost") - sum(a, "igv") - sum(a, "fee");
  const campName = (id: string, fallback = "") => campaigns.find((c) => c.id === id)?.name || fallback || "Campaña borrada";
  const campOk = (r: Row) => campF === "all" || (campF === "none" ? !r.camp : r.camp === campF);
  const byLine = rows.filter((r) => (line === "all" || r.line === line) && campOk(r));
  const f = byLine.filter((r) => chan === "all" || r.ch === chan);
  // Campañas: las creadas en Precios y las que aparecen en ventas (aunque se hayan borrado).
  const campIds = [...new Set([...campaigns.map((c) => c.id), ...rows.filter((r) => r.camp).map((r) => r.camp)])];
  const campOf = (id: string) => campaigns.find((c) => c.id === id);
  const lineRows = rows.filter((r) => line === "all" || r.line === line);
  const campAgg = campIds.map((id) => {
    const a = lineRows.filter((r) => r.camp === id);
    const fallback = a.find((r) => r.campName)?.campName ?? "";
    return { id, name: campName(id, fallback), c: campOf(id), rev: sum(a, "rev"), contrib: contrib(a), units: sum(a, "units"), discount: sum(a, "listRev") - sum(a, "rev"), byCh: CHANNELS.map(([k, l]) => ({ k, l, rev: sum(a.filter((r) => r.ch === k), "rev") })).filter((x) => x.rev > 0) };
  });
  const rev = sum(f, "rev"), cst = sum(f, "cost"), units = sum(f, "units"), orders = sum(f, "orders"), del = sum(f, "dIn") - sum(f, "dOut") - sum(f, "dCut");
  const igv = sum(f, "igv"), fee = sum(f, "fee"), cut = igv + fee, net = rev - cst - cut;
  // Ventas con tarjeta sin comisión cargada: se avisa para que la marca la configure.
  const cardNoFee = (["card_web", "card_pos"] as const).filter((k) => !feesConfigured(fees, k) && f.some((r) => r.card && (k === "card_web") === (r.ch === "web")));

  const chanAgg = CHANNELS.map(([k, label]) => {
    const a = byLine.filter((r) => r.ch === k);
    // Subcategorías del canal: lo vendido con precio de cada campaña.
    const subs = [...new Set(a.filter((r) => r.camp).map((r) => r.camp))].map((id) => {
      const b = a.filter((r) => r.camp === id);
      return { id, label: campName(id, b.find((r) => r.campName)?.campName), rev: sum(b, "rev"), contrib: contrib(b), units: sum(b, "units") };
    });
    return { k, label, rev: sum(a, "rev"), contrib: contrib(a), units: sum(a, "units"), subs };
  });
  const maxRev = Math.max(1, ...chanAgg.map((c) => c.rev));
  const prodAgg = catalog.products.map((p) => { const a = f.filter((r) => r.pid === p.id); return { p, units: sum(a, "units"), contrib: contrib(a) }; }).filter((x) => x.units > 0);
  prodAgg.sort((a, b) => (rank === "c" ? b.contrib - a.contrib : b.units - a.units));
  const top = prodAgg.slice(0, 5);
  const maxK = Math.max(1, ...top.map((x) => (rank === "c" ? x.contrib : x.units)));
  // Solo ventas registradas (las de ejemplo no tienen fecha ni feria). «cost» incluye IGV y comisiones, como la contribución del resto.
  const fairRows = byLine.filter((r) => r.ch === "feria" && r.fair !== null && r.fair !== "").map((r) => ({ fair: r.fair as string, rev: r.rev, cost: r.rev - contrib([r]), units: r.units }));
  const fairLoose = manual.filter((s) => fairOf(s) === "").length;
  const chanName = (k: string) => CHANNELS.find((c) => c[0] === k)?.[1] ?? k;
  const recent = [
    ...manual.slice().reverse().map((s) => {
      const r = s.lines.reduce((a, l) => a + l.price * l.qty, 0);
      const c = s.lines.reduce((a, l) => a + (l.cost ?? cost(l.productId, l.variantId)) * l.qty, 0);
      const ls = s.lines.map((l, i) => saleLine(l, s.channel, !i, s.dIn, s.dOut, s.pay));
      const cutS = sum(ls, "igv") + sum(ls, "fee") + sum(ls, "dCut");
      const camps = [...new Set(s.lines.filter((l) => l.campaignId).map((l) => campName(l.campaignId!, l.campaign)))];
      return { date: s.date, detail: s.lines.map((l) => `${prod(l.productId)?.name ?? (l.name ? `A medida: ${l.name}` : l.productId)} x${l.qty}`).join(" + "), note: camps.length ? `${saleCaption(s, money)} · campaña ${camps.join(", ")}` : saleCaption(s, money), channel: s.channel, revenue: r + s.dIn, contribution: r - c + s.dIn - s.dOut - cutS };
    }),
    ...demo.sales.recent,
  ];

  const exportCsv = () => {
    const list: ExportSale[] = manual.filter((s) => s.day).map((s) => ({ ref: s.ref ?? s.id, day: s.day!, channel: s.channel, client: s.client, pay: s.pay, lines: s.lines, dIn: s.dIn, dOut: s.dOut, note: s.note }));
    const webSales: ExportSale[] = fromDb
      ? dbOrders
          .filter((o) => o.createdIso && o.status !== "cancelado" && !["failed", "refunded"].includes(o.paymentStatus ?? ""))
          .map((o) => ({ ref: `web-${o.id}`, day: new Date(Date.parse(o.createdIso!) - 5 * 3600_000).toISOString().slice(0, 10), channel: "web", client: o.client, pay: o.payment, lines: o.lines, dIn: o.deliveryFee, dOut: o.deliveryReal ?? o.deliveryFee, note: "" }))
      : [];
    const all = [...list, ...webSales].sort((a, b) => a.day.localeCompare(b.day));
    if (!all.length) return toast("Todavía no hay ventas registradas para exportar");
    download(`ventas-${bundle.tenant.slug}-${limaToday()}.csv`, salesToCsv(all, catalog));
    toast(`${all.length} ${all.length === 1 ? "venta exportada" : "ventas exportadas"}`);
  };

  return (
    <AdminPage title="Ventas" topRight={<Link className="a-btn primary sm" href="/admin/ventas/nueva">+ Venta</Link>}>
      <div className="a-head">
        <div className="stack g1"><h1 className="a-h1">Ventas y márgenes</h1><p className="a-sub">Todos los canales en un solo lugar. Montos aproximados según los costos cargados. La contribución ya descuenta el IGV y las comisiones de cada medio de pago (<Link href="/admin/ajustes#pagos">configurar</Link>).</p></div>
        <div className="row g2 wrap-row"><Link className="a-btn" href="/admin/ventas/culqi">Cobros Culqi</Link><Link className="a-btn" href="/admin/ventas/importar">Importar ventas</Link><button className="a-btn" type="button" onClick={exportCsv}>Exportar CSV</button><Link className="a-btn primary only-d" href="/admin/ventas/nueva">+ Registrar venta</Link></div>
      </div>
      <div className="row g3 wrap-row">
        <div className="a-seg" role="group" aria-label="Período">
          {([["mes", "Octubre"], ["tri", "Trimestre"], ["ano", "2026"]] as const).map(([k, l]) => <button key={k} className={period === k ? "on" : ""} type="button" aria-pressed={period === k} onClick={() => setPeriod(k)}>{l}</button>)}
        </div>
        <select className="a-select" style={{ width: "auto", minWidth: 200 }} value={line} onChange={(e) => setLine(e.target.value)} aria-label="Línea">
          <option value="all">Todas las líneas</option>
          {catalog.lines.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
        {campIds.length > 0 && (
          <select className="a-select" style={{ width: "auto", minWidth: 200 }} value={campF} onChange={(e) => setCampF(e.target.value)} aria-label="Campaña">
            <option value="all">Con y sin campaña</option>
            <option value="none">Solo precio regular</option>
            {campAgg.map((c) => <option key={c.id} value={c.id}>Campaña: {c.name}</option>)}
          </select>
        )}
      </div>
      <div className="a-scroll-x" role="group" aria-label="Canal">
        {[["all", "Todos los canales"], ...CHANNELS].map(([k, l]) => <button key={k} className={`a-chip ${chan === k ? "on" : ""}`} type="button" aria-pressed={chan === k} onClick={() => setChan(k)}>{l}</button>)}
      </div>
      {cardNoFee.length > 0 && (
        <div className="a-card row between g3 wrap-row" role="status">
          <p className="a-cap" style={{ margin: 0 }}>Hay ventas con {cardNoFee.map((k) => (k === "card_web" ? "tarjeta en la web" : "tarjeta con POS")).join(" y ")} y aún no pusiste la comisión: por ahora solo se descuenta el IGV.</p>
          <Link className="a-btn sm" href="/admin/ajustes#pagos">Poner comisión</Link>
        </div>
      )}
      <div className="kpis5">
        <div className="kpi"><span className="l">Ingresos</span><span className="v money">{moneyShort(rev)}</span><span className="a-cap">{orders} ventas</span></div>
        <div className="kpi"><span className="l">Costo de productos</span><span className="v money">{moneyShort(cst)}</span><span className="a-cap">Según costo por variante</span></div>
        <div className="kpi"><span className="l">Contribución</span><span className="v money">{moneyShort(net)}</span><span className="a-cap">Margen {rev ? Math.round((net / rev) * 100) : 0}%{cut > 0 ? ` · tras IGV ${moneyShort(igv)} y comisiones ${moneyShort(fee)}` : ""}</span></div>
        <div className="kpi"><span className="l">Unidades</span><span className="v">{units}</span><span className="a-cap">Ticket prom. {orders ? moneyShort(rev / orders) : "—"}</span></div>
        <div className="kpi"><span className="l">Resultado delivery</span><span className="v money" style={{ color: del >= 0 ? "#1F6B35" : "#B42318" }}>{del >= 0 ? "+ " : "− "}{moneyShort(Math.abs(del))}</span><span className="a-cap">Cobrado {moneyShort(sum(f, "dIn"))} · costó {moneyShort(sum(f, "dOut"))}{sum(f, "dCut") > 0 ? ` · IGV y comisión ${moneyShort(sum(f, "dCut"))}` : ""}</span></div>
      </div>
      <div className="a-cols even">
        <section className="a-card" aria-labelledby="v-ch">
          <div className="a-card-h"><h2 className="a-h2" id="v-ch">Por canal</h2><div className="legend"><span><i style={{ background: "#C9CFC3" }} />Ingresos</span><span><i style={{ background: "#1F2A22" }} />Contribución</span></div></div>
          {chanAgg.map((c) => (
            <div key={c.k}>
              <div className="chbar">
                <span><b>{c.label}</b><br /><span className="a-cap">{c.units} u.</span></span>
                <div className="track" role="img" aria-label={`${c.label}: ingresos ${moneyShort(c.rev)}, contribución ${moneyShort(c.contrib)}`}><i style={{ width: `${(c.rev / maxRev) * 100}%` }} /><b style={{ width: `${(Math.max(0, c.contrib) / maxRev) * 100}%` }} /></div>
                <span className="money" style={{ textAlign: "right" }}><b>{moneyShort(c.rev)}</b><br /><span className="a-cap">{moneyShort(c.contrib)}</span></span>
              </div>
              {c.subs.map((x) => (
                <div className="chbar sub" key={x.id}>
                  <span><b>↳ {x.label}</b><br /><span className="a-cap">{x.units} u.</span></span>
                  <div className="track" role="img" aria-label={`${c.label}, campaña ${x.label}: ingresos ${moneyShort(x.rev)}, contribución ${moneyShort(x.contrib)}`}><i style={{ width: `${(x.rev / maxRev) * 100}%` }} /><b style={{ width: `${(Math.max(0, x.contrib) / maxRev) * 100}%` }} /></div>
                  <span className="money" style={{ textAlign: "right" }}>{moneyShort(x.rev)}<br /><span className="a-cap">{moneyShort(x.contrib)}</span></span>
                </div>
              ))}
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
      {campAgg.length > 0 && (
        <section className="a-card flush" aria-labelledby="v-camp">
          <div className="a-card-h" style={{ flexWrap: "wrap" }}><div className="stack g1"><h2 className="a-h2" id="v-camp">Campañas de oferta</h2><p className="a-cap">Lo vendido con precio de campaña, por canal. Descuento = precio regular − precio cobrado.</p></div><Link className="a-btn sm ghost" href="/admin/productos#precios">Editar campañas</Link></div>
          <div className="a-table">
            <div className="a-tr head" style={{ gridTemplateColumns: CAMP_COLS }}><span>Campaña</span><span>Canales</span><span>Unidades</span><span>Ingresos</span><span>Descuento</span><span>Contribución</span></div>
            {campAgg.map((c) => {
              const s = c.c && now ? campaignState(c.c, now) : null;
              return (
                <div key={c.id} className="a-tr" style={{ gridTemplateColumns: CAMP_COLS }}>
                  <span className="stack" style={{ gap: 2 }}>
                    <b>{c.name}</b>
                    <span className="a-cap">{c.c ? campaignRange(c.c) : "Ya no existe en Precios"}{s && <> · <span className={`st ${CAMPAIGN_STATE[s][1]}`}>{CAMPAIGN_STATE[s][0]}</span></>}</span>
                    <span className="c-m a-cap">{c.units} u. · {moneyShort(c.rev)} · contribución {moneyShort(c.contrib)}</span>
                  </span>
                  <span className="c-d a-cap">{c.byCh.length ? c.byCh.map((x) => `${x.l} ${moneyShort(x.rev)}`).join(" · ") : "Sin ventas todavía"}</span>
                  <span className="c-d">{c.units}</span>
                  <span className="c-d money" style={{ fontWeight: 700 }}>{moneyShort(c.rev)}</span>
                  <span className="c-d money">{c.discount > 0 ? `− ${moneyShort(c.discount)}` : "—"}</span>
                  <span className="money">{moneyShort(c.contrib)}</span>
                </div>
              );
            })}
          </div>
        </section>
      )}
      <FairsSection rows={fairRows} unassigned={fairLoose} />
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
