"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { money } from "@/lib/admin/format";
import { culqiStatement, type CulqiOrigin, type CulqiRow, type CulqiStatement } from "@/app/admin/culqi-actions";
import { useAdmin } from "../AdminContext";
import { AdminPage } from "../AdminPage";
import { download } from "./SalesView";

const ORIGIN: Record<CulqiOrigin, [string, string]> = {
  web: ["Tienda web", "pagado"],
  "web-sin-pedido": ["Web · revisar", "pend"],
  otro: ["Otro canal", "cancelado"],
};

const PAY_STATUS: Record<string, string> = { paid: "pagado", pending: "pago pendiente", failed: "pago fallido", refunded: "devuelto" };

const COLS = "120px minmax(0, 1.3fr) 120px 100px 100px 100px";

/** Mes actual en hora de Lima: "2026-11". */
function limaMonth() {
  return new Date(Date.now() - 5 * 3600_000).toISOString().slice(0, 7);
}

const day = (iso: string) => (iso ? new Date(Date.parse(iso) - 5 * 3600_000).toISOString().slice(0, 10) : "—");
const opt = (n: number | null) => (n === null ? "" : n.toFixed(2));
const csvCell = (v: string) => (/[",\n;]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

function toCsv(rows: CulqiRow[]) {
  const head = ["fecha", "id_cobro_culqi", "origen", "pedido", "descripcion", "tarjeta", "correo", "monto", "devuelto", "comision", "neto"];
  const lines = rows.map((r) => [day(r.date), r.id, ORIGIN[r.origin][0], r.order, r.description, r.card, r.email, r.amount.toFixed(2), r.refunded.toFixed(2), opt(r.fee), opt(r.net)].map(csvCell).join(","));
  return [head.join(","), ...lines].join("\n");
}

/** Cobros de la cuenta Culqi de la marca, separados en tienda web y otros canales, para cuadrar con el EECC. */
export function CulqiStatementView() {
  const { bundle, toast } = useAdmin();
  const [month, setMonth] = useState("");
  const [maxMonth, setMaxMonth] = useState<string | undefined>();
  const [data, setData] = useState<CulqiStatement | null>(null);
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState<"all" | CulqiOrigin>("all");

  const load = useCallback(async (m: string) => {
    setBusy(true);
    try {
      setData(await culqiStatement(m));
    } catch {
      setData({ ok: false, message: "No pudimos consultar a Culqi. Intenta de nuevo en unos minutos." });
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    const m = limaMonth();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- el mes depende de la hora del navegador
    setMonth(m);
    setMaxMonth(m);
    void load(m);
  }, [load]);

  const rows = data?.ok ? data.rows : [];
  const shown = rows.filter((r) => filter === "all" || r.origin === filter);
  const web = rows.filter((r) => r.origin !== "otro");
  const other = rows.filter((r) => r.origin === "otro");
  const tot = (a: CulqiRow[], k: "amount" | "refunded") => a.reduce((s, r) => s + r[k], 0);
  const fees = web.filter((r) => r.fee !== null);
  const feeSum = fees.reduce((s, r) => s + (r.fee ?? 0), 0);
  const netKnown = web.every((r) => r.net !== null);
  const netSum = web.reduce((s, r) => s + (r.net ?? 0), 0);
  const review = rows.filter((r) => r.origin === "web-sin-pedido");

  const exportCsv = () => {
    if (!shown.length) return toast("No hay cobros para exportar en este mes");
    download(`culqi-${bundle.tenant.slug}-${month}.csv`, toCsv(shown));
    toast(`${shown.length} ${shown.length === 1 ? "cobro exportado" : "cobros exportados"}`);
  };

  return (
    <AdminPage title="Cobros Culqi" back={{ href: "/admin/ventas", label: "Ventas" }}>
      <div className="a-head">
        <div className="stack g1">
          <h1 className="a-h1">Cobros con tarjeta (Culqi)</h1>
          <p className="a-sub">Todo lo que entró a tu cuenta de Culqi en el mes. Los cobros de la tienda web van marcados con el pedido; el resto viene de otros sitios donde uses la misma cuenta.</p>
        </div>
        <div className="row g2 wrap-row">
          <button className="a-btn" type="button" onClick={exportCsv} disabled={busy || !shown.length}>Exportar CSV</button>
        </div>
      </div>

      <div className="row g3 wrap-row">
        <label className="stack g1" style={{ minWidth: 180 }}>
          <span className="a-cap">Mes</span>
          <input className="a-input" type="month" value={month} max={maxMonth} onChange={(e) => { setMonth(e.target.value); if (e.target.value) void load(e.target.value); }} />
        </label>
        <button className="a-btn" type="button" onClick={() => month && load(month)} disabled={busy} style={{ alignSelf: "flex-end" }}>{busy ? "Consultando…" : "Actualizar"}</button>
      </div>

      {data && !data.ok && <p className="a-card" role="alert">{data.message}</p>}

      {data?.ok && (
        <>
          {!data.live && <p className="a-cap">Cuenta en modo prueba: estos son cobros de prueba, no dinero real.</p>}
          {data.source === "pedidos" && <p className="a-cap" role="status">Culqi no devolvió el listado completo de la cuenta; solo se muestran los cobros de pedidos de la tienda web. Los de otros canales no aparecen.</p>}
          {data.truncated && <p className="a-cap" role="status">El mes tiene más de 1,000 cobros: se muestran los primeros. Exporta desde CulqiPanel para el detalle completo.</p>}

          <div className="kpis5">
            <div className="kpi"><span className="l">Cobrado en la web</span><span className="v money">{money(tot(web, "amount"))}</span><span className="a-cap">{web.length} cobros</span></div>
            <div className="kpi"><span className="l">Comisión Culqi (web)</span><span className="v money">{fees.length ? `− ${money(feeSum)}` : "—"}</span><span className="a-cap">{fees.length === web.length ? "Según Culqi" : `${web.length - fees.length} sin dato · ver EECC`}</span></div>
            <div className="kpi"><span className="l">Neto web</span><span className="v money">{netKnown && web.length ? money(netSum) : "—"}</span><span className="a-cap">{netKnown ? "Cobrado − comisión − devoluciones" : "Completa con el EECC"}</span></div>
            <div className="kpi"><span className="l">Devoluciones web</span><span className="v money">{money(tot(web, "refunded"))}</span><span className="a-cap">{web.filter((r) => r.refunded > 0).length} cobros</span></div>
            <div className="kpi"><span className="l">Otros canales</span><span className="v money">{money(tot(other, "amount"))}</span><span className="a-cap">{other.length} cobros fuera de la web</span></div>
          </div>

          {(review.length > 0 || data.missing.length > 0) && (
            <section className="a-card" aria-labelledby="c-rev">
              <h2 className="a-h2" id="c-rev">Para revisar</h2>
              <ul className="stack g2" style={{ margin: 0, paddingLeft: 18 }}>
                {review.map((r) => (
                  <li key={r.id}>Cobro <b>{r.id}</b> de {money(r.amount)} viene de la web{r.order ? <> (pedido <Link href={`/admin/pedidos/${r.order}`}>{r.order}</Link>)</> : ""}, pero el pedido no figura pagado con ese cobro{r.orderPayment ? ` (figura como ${PAY_STATUS[r.orderPayment] ?? r.orderPayment})` : ""}.</li>
                ))}
                {data.missing.map((m) => (
                  <li key={m.orderId}>El pedido <Link href={`/admin/pedidos/${m.order}`}>{m.order}</Link> figura pagado con tarjeta ({money(m.total)}) pero su cobro <b>{m.ref}</b> no aparece en Culqi este mes.</li>
                ))}
              </ul>
            </section>
          )}

          <div className="a-scroll-x" role="group" aria-label="Origen del cobro">
            {([["all", "Todos"], ["web", "Tienda web"], ["web-sin-pedido", "Web · revisar"], ["otro", "Otros canales"]] as const).map(([k, l]) => (
              <button key={k} className={`a-chip ${filter === k ? "on" : ""}`} type="button" aria-pressed={filter === k} onClick={() => setFilter(k)}>{l}</button>
            ))}
          </div>

          <section className="a-card flush" aria-labelledby="c-list">
            <div className="a-card-h"><h2 className="a-h2" id="c-list">Cobros del mes</h2><span className="a-cap">{shown.length} cobros</span></div>
            <div className="a-table">
              <div className="a-tr head" style={{ gridTemplateColumns: COLS }}><span>Fecha</span><span>Cobro</span><span>Origen</span><span>Monto</span><span>Comisión</span><span>Neto</span></div>
              {!busy && !shown.length && <div className="a-tr" style={{ gridTemplateColumns: "1fr" }}><span className="a-cap">No hay cobros aprobados en este mes.</span></div>}
              {shown.map((r) => (
                <div key={r.id} className="a-tr" style={{ gridTemplateColumns: COLS }}>
                  <span className="c-d">{day(r.date)}</span>
                  <span className="stack" style={{ gap: 2 }}>
                    <b>{r.order ? <Link href={`/admin/pedidos/${r.order}`}>Pedido {r.order}</Link> : r.description || "Sin descripción"}</b>
                    <span className="a-cap" style={{ overflowWrap: "anywhere" }}>{[r.id, r.card, r.email].filter(Boolean).join(" · ")}</span>
                    {r.refunded > 0 && <span className="a-cap">Devuelto {money(r.refunded)}</span>}
                    <span className="c-m a-cap">{day(r.date)} · {ORIGIN[r.origin][0]} · comisión {r.fee === null ? "—" : money(r.fee)}</span>
                  </span>
                  <span className="c-d"><span className={`st ${ORIGIN[r.origin][1]}`}>{ORIGIN[r.origin][0]}</span></span>
                  <span className="money" style={{ fontWeight: 700 }}>{money(r.amount)}</span>
                  <span className="c-d money">{r.fee === null ? "—" : `− ${money(r.fee)}`}</span>
                  <span className="c-d money">{r.net === null ? "—" : money(r.net)}</span>
                </div>
              ))}
            </div>
          </section>
          <p className="a-cap">Para cuadrar: exporta este CSV y el reporte de CulqiPanel del mismo mes, y cruza por el id del cobro (chr_…). Si Culqi no reporta la comisión en el cobro, sale con «—» y se toma del EECC.</p>
        </>
      )}
    </AdminPage>
  );
}
