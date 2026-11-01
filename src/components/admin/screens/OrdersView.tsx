"use client";

import Link from "next/link";
import { useState } from "react";
import { DELIVERY_STATUS, money, ORDER_STATUS } from "@/lib/admin/format";
import type { DemoOrder } from "@/lib/admin/types";
import { useAdminCatalog, useOrders } from "../AdminContext";
import { AdminPage } from "../AdminPage";
import { AIBell, AISearch } from "../AdminIcons";

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

export function OrdersView() {
  const { orders } = useOrders();
  const { catalog } = useAdminCatalog();
  const [f, setF] = useState("all");
  const [q, setQ] = useState("");
  const name = (id: string) => catalog.products.find((p) => p.id === id)?.name ?? id;
  const items = (o: DemoOrder) => o.lines.map((l) => `${name(l.productId)}${l.qty > 1 ? ` ×${l.qty}` : ""}`).join(" + ");
  const defs: [string, string][] = [["all", "Todos"], ["nuevo", "Nuevo"], ["prep", "En preparación"], ["listo", "Listo"], ["entregado", "Entregado"], ["cancelado", "Cancelado"]];
  const rows = orders
    .filter((o) => f === "all" || o.status === f)
    .filter((o) => !q || `${o.id} ${o.client} ${o.phone}`.toLowerCase().includes(q.toLowerCase().replace("#", "")));
  const nNew = orders.filter((o) => o.status === "nuevo").length;
  const nDiff = orders.filter((o) => deliveryState(o)[1] === "pend" || deliveryState(o)[0].startsWith("Devolver")).length;
  const cols = { gridTemplateColumns: "90px minmax(0, 1.4fr) minmax(0, 1fr) 110px 150px 130px" };

  return (
    <AdminPage title="Pedidos" topRight={<Link className="a-btn ghost sm" href="/admin/notificaciones" aria-label="Notificaciones"><AIBell /></Link>}>
      <div className="a-head">
        <div className="stack g1"><h1 className="a-h1">Pedidos</h1><p className="a-sub">{nNew} nuevos · {nDiff} diferencias de delivery por resolver</p></div>
        <div className="a-search"><AISearch size="sm" /><input placeholder="Buscar por N.º, cliente o celular" aria-label="Buscar pedidos" value={q} onChange={(e) => setQ(e.target.value)} /></div>
      </div>
      <div className="a-scroll-x" role="group" aria-label="Filtrar por estado">
        {defs.map(([k, label]) => (
          <button key={k} className={`a-chip ${f === k ? "on" : ""}`} type="button" aria-pressed={f === k} onClick={() => setF(k)}>
            {label} <span className="n">{k === "all" ? orders.length : orders.filter((o) => o.status === k).length}</span>
          </button>
        ))}
      </div>
      <section className="a-card flush">
        <div className="a-table">
          <div className="a-tr head" style={cols}><span>Pedido</span><span>Cliente y productos</span><span>Entrega</span><span>Total</span><span>Delivery</span><span>Estado</span></div>
          {rows.map((o) => {
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
          {!rows.length && <p className="a-cap" style={{ padding: 20 }}>No hay pedidos con ese filtro.</p>}
        </div>
      </section>
    </AdminPage>
  );
}
