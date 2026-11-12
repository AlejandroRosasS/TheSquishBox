"use client";

import Link from "next/link";
import { useState } from "react";
import { DELIVERY_STATUS, money, ORDER_STATUS, partyStatus } from "@/lib/admin/format";
import type { DemoOrder, PartyRequest } from "@/lib/admin/types";
import { useAdmin, useAdminCatalog, useOrders, useParty } from "../AdminContext";
import { AdminPage } from "../AdminPage";
import { AIBell, AIPlus, AISearch } from "../AdminIcons";
import { useInventory } from "../AdminInventory";
import { useToday } from "@/lib/useToday";

export const orderTotal = (o: DemoOrder) => o.lines.reduce((s, l) => s + l.price * l.qty, 0) + o.deliveryFee;

/** Estado del delivery calculado a partir del costo real registrado. */
export function deliveryState(o: DemoOrder & { link?: string; refund?: string }): [string, string] {
  if (o.district.toLowerCase().includes("recojo")) return DELIVERY_STATUS.taller;
  if (o.deliveryReal === null || o.deliveryReal === undefined) return DELIVERY_STATUS.pendconf;
  const diff = o.deliveryReal - o.deliveryFee;
  if (diff === 0) return DELIVERY_STATUS.ok;
  if (diff > 0) return o.link === "pagado" ? DELIVERY_STATUS.pagado : [`Cobrar ${money(diff)}`, "pend"];
  return o.refund === "devuelto" ? [`Devuelto ${money(-diff)}`, "devuelto"] : [`Devolver ${money(-diff)}`, "devuelto"];
}

/** Filtros: estado del pedido; «fiestas» muestra solo los pedidos para fiestas. Las fiestas «nueva» cuentan como nuevos. */
type Filter = "all" | "nuevo" | "prep" | "listo" | "entregado" | "cancelado" | "fiestas";
const PARTY_AS: Record<string, Filter> = { nueva: "nuevo", cotizada: "prep", aceptada: "prep", descartada: "cancelado" };

export function OrdersView() {
  const { bundle } = useAdmin();
  const { customOrder } = bundle.tenant;
  const { orders } = useOrders();
  const { requests } = useParty();
  const parties: PartyRequest[] = customOrder.enabled ? requests : [];
  const partyLabel = customOrder.adminShort ?? customOrder.label;
  const { catalog } = useAdminCatalog();
  const [f, setF] = useState<Filter>("all");
  const [q, setQ] = useState("");
  const items = (o: DemoOrder) => o.lines.map((l) => `${catalog.products.find((p) => p.id === l.productId)?.name ?? l.name ?? l.productId}${l.qty > 1 ? ` ×${l.qty}` : ""}`).join(" + ");
  const defs: [Filter, string][] = [
    ["all", "Todos"], ["nuevo", "Nuevo"], ["prep", "En preparación"], ["listo", "Listo"], ["entregado", "Entregado"], ["cancelado", "Cancelado"],
    ...(parties.length ? ([["fiestas", partyLabel]] as [Filter, string][]) : []),
  ];
  const match = (text: string) => !q || text.toLowerCase().includes(q.toLowerCase().replace("#", ""));
  const orderIn = (o: DemoOrder, k: Filter) => k === "all" || o.status === k;
  const partyIn = (r: PartyRequest, k: Filter) => k === "all" || k === "fiestas" || PARTY_AS[r.status] === k;
  const count = (k: Filter) => (k === "fiestas" ? 0 : orders.filter((o) => orderIn(o, k)).length) + parties.filter((r) => partyIn(r, k)).length;

  const orderRows = f === "fiestas" ? [] : orders.filter((o) => orderIn(o, f) && match(`${o.id} ${o.client} ${o.phone}`));
  const partyRows = parties.filter((r) => partyIn(r, f) && match(`${r.id} ${r.name} ${r.phone}`));
  const nNew = orders.filter((o) => o.status === "nuevo").length;
  const nParty = parties.filter((r) => r.status === "nueva").length;
  const nDiff = orders.filter((o) => deliveryState(o)[1] === "pend" || deliveryState(o)[0].startsWith("Devolver")).length;
  const cols = { gridTemplateColumns: "90px minmax(0, 1.4fr) minmax(0, 1fr) 110px 150px 130px" };
  // Con el inventario prendido, el cotizador queda a un toque (se conoce recién en el navegador).
  const mounted = !!useToday();
  const quotesOn = useInventory().data.enabled && mounted;

  return (
    <AdminPage title="Pedidos" topRight={<Link className="a-btn ghost sm" href="/admin/notificaciones" aria-label="Notificaciones"><AIBell /></Link>}>
      <div className="a-head">
        <div className="stack g1">
          <h1 className="a-h1">Pedidos</h1>
          <p className="a-sub">
            {nNew} nuevos{parties.length ? ` · ${nParty} de ${partyLabel.toLowerCase()} ${customOrder.form === "contact" ? "por responder" : "por cotizar"}` : ""} · {nDiff} diferencias de delivery por resolver
          </p>
        </div>
        <div className="row g2" style={{ flexWrap: "wrap" }}>
          {quotesOn && <Link className="a-btn" href="/admin/inventario#cotizador"><AIPlus size="sm" />Nueva cotización</Link>}
          <div className="a-search"><AISearch size="sm" /><input placeholder="Buscar por N.º, cliente o celular" aria-label="Buscar pedidos" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        </div>
      </div>
      <div className="a-scroll-x" role="group" aria-label="Filtrar pedidos">
        {defs.map(([k, label]) => (
          <button key={k} className={`a-chip ${f === k ? "on" : ""}`} type="button" aria-pressed={f === k} onClick={() => setF(k)}>
            {label} <span className="n">{count(k)}</span>
          </button>
        ))}
      </div>
      <section className="a-card flush">
        <div className="a-table">
          <div className="a-tr head" style={cols}><span>Pedido</span><span>Cliente y productos</span><span>Entrega</span><span>Total</span><span>Delivery</span><span>Estado</span></div>
          {partyRows.map((r) => {
            const [sl, sc] = partyStatus(r);
            const total = (parseFloat(r.price) || 0) + (parseFloat(r.deliveryFee) || 0);
            return (
              <Link key={r.id} className="a-tr" href={`/admin/pedidos/${r.id}`} style={cols}>
                <span className="c-d" style={{ fontWeight: 700 }}>#{r.id}</span>
                <span className="stack">
                  <span className="row g2"><b>{r.name}</b><span className="st nuevo">{partyLabel}</span></span>
                  {r.contact ? (
                    <span className="a-cap" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{[r.reason, r.idea].filter(Boolean).join(" · ")}</span>
                  ) : (
                    <span className="a-cap">{r.qty} · {r.size}</span>
                  )}
                  <span className="c-m a-cap" style={{ marginTop: 2 }}>#{r.id}{r.contact ? "" : ` · ${r.district} · ${r.date}`}</span>
                </span>
                <span className="c-d stack">{r.contact ? <span className="a-cap">—</span> : <><span>{r.district}</span><span className="a-cap">{r.date}</span></>}</span>
                <span className="money" style={{ fontWeight: 700, textAlign: "right" }}>
                  {total ? money(total) : <span className="a-cap">{r.contact ? "Por responder" : "Por cotizar"}</span>}
                  <span className="c-m" style={{ marginTop: 6 }}><span className={`st ${sc}`}>{sl}</span></span>
                </span>
                <span className="c-d"><span className="a-cap">Recibido {r.when}</span></span>
                <span className="c-d"><span className={`st ${sc}`}>{sl}</span></span>
              </Link>
            );
          })}
          {orderRows.map((o) => {
            const [sl, sc] = ORDER_STATUS[o.status];
            const [dl, dc] = deliveryState(o);
            return (
              <Link key={o.id} className="a-tr" href={`/admin/pedidos/${o.id}`} style={cols}>
                <span className="c-d" style={{ fontWeight: 700 }}>#{o.id}</span>
                <span className="stack"><b>{o.client}</b><span className="a-cap">{items(o)}</span><span className="c-m a-cap" style={{ marginTop: 2 }}>#{o.id} · {o.district} · {o.date}</span></span>
                <span className="c-d stack"><span>{o.district}</span><span className="a-cap">{o.date}</span></span>
                <span className="money" style={{ fontWeight: 700, textAlign: "right" }}>{money(orderTotal(o))}<span className="c-m" style={{ marginTop: 6 }}><span className={`st ${sc}`}>{sl}</span></span></span>
                <span className="c-d"><span className={`st ${dc}`}>{dl}</span></span>
                <span className="c-d"><span className={`st ${sc}`}>{sl}</span></span>
              </Link>
            );
          })}
          {!orderRows.length && !partyRows.length && <p className="a-cap" style={{ padding: 20 }}>No hay pedidos con ese filtro.</p>}
        </div>
      </section>
    </AdminPage>
  );
}
