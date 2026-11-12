"use client";

/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { asset } from "@/lib/assets";
import { isSoldOut, tracksStock } from "@/lib/catalog";
import { money, moneyShort, ORDER_STATUS, todayLabel } from "@/lib/admin/format";
import { useAdmin, useAdminCatalog, useOrders } from "../AdminContext";
import { AdminPage } from "../AdminPage";
import { useAdminCounts } from "../AdminShell";
import { AIBell, AIChevron, AIInstagram, AIPlus } from "../AdminIcons";
import { useInventory } from "../AdminInventory";
import { useToday } from "@/lib/useToday";
import { useWeekSales } from "../useWeekSales";
import { useOrdersFromDb } from "../AdminOrders";

export function HomeAdminView() {
  const { bundle, demo } = useAdmin();
  const { tenant } = bundle;
  const { orders } = useOrders();
  const { catalog } = useAdminCatalog();
  const c = useAdminCounts();
  const a = (p: string) => asset(tenant.slug, p);
  const pname = (id: string) => catalog.products.find((p) => p.id === id);

  const pending = orders.filter((o) => o.status === "nuevo" || o.delivery === "pend").slice(0, 4);
  const toDeliver = orders.filter((o) => o.status === "listo" || o.status === "prep").length;
  const diffs = orders.filter((o) => o.delivery === "pend" || o.delivery === "dev").length;
  const stock = catalog.products
    .filter((p) => p.status !== "draft")
    .map((p) => {
      const low = tracksStock(p) ? p.variants.filter((v) => v.stock > 0 && v.stock <= 5) : [];
      if (isSoldOut(p) || (!tracksStock(p) && p.available === false)) return { p, label: "Agotado", cls: "agotado", cap: "Sin stock" };
      if (low.length) return { p, label: "Stock bajo", cls: "bajo", cap: low.map((v) => (p.variants.length > 1 ? `${v.label} · quedan ${v.stock}` : `Quedan ${v.stock}`)).join(" · ") };
      return null;
    })
    .filter(Boolean)
    .slice(0, 4) as { p: (typeof catalog.products)[number]; label: string; cls: string; cap: string }[];
  const week = useWeekSales();
  const fromDb = useOrdersFromDb();
  const today = useToday();
  const peak = week?.days.reduce((a, d) => (d.amount > a.amount ? d : a), week.days[0]);
  const partyLabel = tenant.customOrder.adminLabel ?? tenant.customOrder.label;
  // Con el inventario prendido, el cotizador queda a un toque (se conoce recién en el navegador).
  const mounted = !!useToday();
  const quotesOn = useInventory().data.enabled && mounted;

  const summary = (o: (typeof orders)[number]) =>
    o.lines.map((l) => `${pname(l.productId)?.name ?? l.name ?? l.productId}${l.qty > 1 ? ` ×${l.qty}` : ""}`).join(" + ");
  const total = (o: (typeof orders)[number]) => o.lines.reduce((s, l) => s + l.price * l.qty, 0) + o.deliveryFee;

  return (
    <AdminPage title="Inicio" topRight={<Link className="a-btn ghost sm" href="/admin/notificaciones" aria-label="Notificaciones"><AIBell /></Link>}>
      <div className="a-head">
        <div className="stack g1">
          <h1 className="a-h1">Hola, equipo</h1>
          <p className="a-sub">{fromDb ? (today ? todayLabel(today) : "Hoy") : todayLabel(demo.today)} · esto es lo que necesita atención hoy.</p>
        </div>
        <div className="row g2" style={{ flexWrap: "wrap" }}>
          {quotesOn && <Link className="a-btn primary" href="/admin/inventario#cotizador"><AIPlus size="sm" />Nueva cotización</Link>}
          {c.newPosts > 0 && (
            <Link className="a-btn" href="/admin/instagram"><AIInstagram />{c.newPosts} posts nuevos en Instagram</Link>
          )}
        </div>
      </div>

      <div className="kpis">
        <Link className="kpi" href="/admin/pedidos"><span className="l"><span className="st nuevo">Nuevos</span></span><span className="v">{c.newOrders}</span><span className="a-cap">pedidos pagados por atender</span><span className="go">Ver pedidos <AIChevron size="sm" /></span></Link>
        <Link className="kpi" href="/admin/pedidos"><span className="l"><span className="st listo">Por entregar</span></span><span className="v">{toDeliver}</span><span className="a-cap">en preparación o listos</span><span className="go">Ver lista <AIChevron size="sm" /></span></Link>
        <Link className={`kpi ${diffs ? "alert" : ""}`} href="/admin/pedidos"><span className="l"><span className="st pend">Delivery</span></span><span className="v">{diffs}</span><span className="a-cap">diferencias de delivery pendientes</span><span className="go">Resolver <AIChevron size="sm" /></span></Link>
        {tenant.customOrder.enabled && (
          <Link className="kpi" href="/admin/pedidos"><span className="l"><span className="st nuevo">{tenant.customOrder.adminShort ?? partyLabel}</span></span><span className="v">{c.newParty}</span><span className="a-cap">{partyLabel.toLowerCase()} por cotizar</span><span className="go">Responder <AIChevron size="sm" /></span></Link>
        )}
        <Link className="kpi" href="/admin/productos"><span className="l"><span className="st bajo">Inventario</span></span><span className="v">{c.lowStock}</span><span className="a-cap">productos con stock bajo o agotados</span><span className="go">Revisar <AIChevron size="sm" /></span></Link>
        <Link className="kpi" href="/admin/ventas"><span className="l">Ventas de la semana · todos los canales</span><span className="v money">{week ? moneyShort(week.total) : "…"}</span><span className="a-cap">{week ? `${week.count} ${week.count === 1 ? "venta" : "ventas"} · contribución ${moneyShort(week.contribution)}` : "Cargando…"}</span><span className="go">Ver ventas y márgenes <AIChevron size="sm" /></span></Link>
      </div>

      <div className="a-cols">
        <section className="a-card flush" aria-labelledby="h-ped">
          <div className="a-card-h"><h2 className="a-h2" id="h-ped">Pedidos por atender</h2><Link className="a-btn sm ghost" href="/admin/pedidos">Ver todos</Link></div>
          <div className="a-table">
            {pending.map((o) => {
              const [sl, sc] = o.delivery === "pend" ? ["Dif. pendiente", "pend"] : ORDER_STATUS[o.status];
              const first = pname(o.lines[0]?.productId);
              return (
                <Link key={o.id} className="a-tr" href={`/admin/pedidos/${o.id}`} style={{ gridTemplateColumns: "48px minmax(0, 1fr) 120px 110px" }}>
                  <span className="av">{first && <img src={a(first.images[0])} alt="" />}</span>
                  <span className="stack"><b>#{o.id} · {o.client}</b><span className="a-cap">{summary(o)} · {o.district} · {o.date}</span><span className="c-m" style={{ marginTop: 6 }}><span className={`st ${sc}`}>{sl}</span></span></span>
                  <span className="c-d money" style={{ fontWeight: 700 }}>{money(total(o))}</span>
                  <span className="c-d"><span className={`st ${sc}`}>{sl}</span></span>
                </Link>
              );
            })}
            {!pending.length && <p className="a-cap" style={{ padding: 20 }}>No hay pedidos por atender. ¡Todo al día!</p>}
          </div>
        </section>

        <div className="stack g5">
          <section className="a-card" aria-labelledby="h-ven">
            <div className="a-card-h"><h2 className="a-h2" id="h-ven">Ventas · últimos 7 días</h2></div>
            {week && (
              <div className="bars" role="img" aria-label={week.total || week.demo ? `Ventas diarias de los últimos 7 días${week.demo ? " (datos de ejemplo)" : ""}. El día más alto es ${peak?.label}${week.demo ? "" : `, con ${money(peak?.amount ?? 0)}`}.` : "Sin ventas en los últimos 7 días."}>
                {week.days.map((d, i) => (
                  <div key={i}><i className={i === week.days.length - 1 ? "on" : ""} style={{ height: `${d.pct}%` }} title={week.demo ? undefined : money(d.amount)} /><span>{d.label}</span></div>
                ))}
              </div>
            )}
            {week && !week.demo && !week.total && <p className="a-cap">Todavía no hay ventas en los últimos 7 días.</p>}
          </section>
          <section className="a-card" aria-labelledby="h-inv">
            <div className="a-card-h"><h2 className="a-h2" id="h-inv">Inventario</h2><Link className="a-btn sm ghost" href="/admin/productos">Ver</Link></div>
            {stock.map(({ p, label, cls, cap }) => (
              <Link key={p.id} className="row g3" href={`/admin/productos/${p.id}`} style={{ textDecoration: "none" }}>
                <span className="av"><img src={a(p.images[0])} alt="" /></span>
                <div className="grow"><b>{p.name}</b><p className="a-cap">{cap}</p></div>
                <span className={`st ${cls}`}>{label}</span>
              </Link>
            ))}
            {!stock.length && <p className="a-cap">Todo con stock suficiente.</p>}
          </section>
        </div>
      </div>
    </AdminPage>
  );
}
