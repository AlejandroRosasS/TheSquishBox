"use client";

/* eslint-disable @next/next/no-img-element */
import { useRouter } from "next/navigation";
import { useState } from "react";
import { asset } from "@/lib/assets";
import { money } from "@/lib/admin/format";
import { useAdmin, useAdminCatalog } from "../AdminContext";
import { AdminPage, BackLink, Switch } from "../AdminPage";
import { AIPlus, AITrash } from "../AdminIcons";
import { useManualSales, type ManualSale } from "./SalesView";

const CH: [string, string, string][] = [["ig", "Instagram", "Venta por DM o WhatsApp"], ["feria", "Feria o evento", "Asociada a una feria"], ["otros", "Otros", "Colegios, referidos, empresas"]];
const PAYS = ["Yape", "Plin", "Efectivo", "Transferencia", "Tarjeta (POS)"];

export function NewSaleView() {
  const { bundle, demo, toast } = useAdmin();
  const { catalog } = useAdminCatalog();
  const [, setSales] = useManualSales();
  const router = useRouter();
  const products = catalog.products.filter((p) => p.status !== "draft" || p.variants.length);
  const [chan, setChan] = useState("feria");
  const [date, setDate] = useState(demo.today);
  const [client, setClient] = useState("");
  const [lines, setLines] = useState<ManualSale["lines"]>(() => (products[0] ? [{ productId: products[0].id, variantId: products[0].variants[0]?.id ?? "", qty: 1, price: products[0].variants[0]?.price ?? 0 }] : []));
  const [del, setDel] = useState(false);
  const [dIn, setDIn] = useState("");
  const [dOut, setDOut] = useState("");
  const [pay, setPay] = useState("Efectivo");
  const [discount, setDiscount] = useState(true);
  const prod = (id: string) => catalog.products.find((p) => p.id === id);
  const cost = (l: ManualSale["lines"][number]) => catalog.costs[l.productId]?.[l.variantId] ?? 0;
  const upd = (i: number, patch: Partial<ManualSale["lines"][number]>) => setLines((ls) => ls.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  const rev = lines.reduce((a, l) => a + l.price * l.qty, 0);
  const cst = lines.reduce((a, l) => a + cost(l) * l.qty, 0);
  const units = lines.reduce((a, l) => a + l.qty, 0);
  const d = del ? (parseFloat(dIn) || 0) - (parseFloat(dOut) || 0) : 0;
  const contrib = rev - cst + d;

  const save = (again: boolean) => {
    if (!lines.length) return toast("Agrega al menos un producto");
    const sale: ManualSale = { id: `m${Date.now()}`, date: new Intl.DateTimeFormat("es-PE", { day: "numeric", month: "short" }).format(new Date(`${date}T12:00:00`)).replace(".", ""), channel: chan, client, pay, lines, dIn: del ? parseFloat(dIn) || 0 : 0, dOut: del ? parseFloat(dOut) || 0 : 0, note: `${pay}${del ? ` · delivery ${money(parseFloat(dIn) || 0)}` : " · sin delivery"}${client ? ` · ${client}` : ""}` };
    setSales((s) => [...s, sale]);
    toast("Venta registrada");
    if (again) { setLines(lines.slice(0, 1).map((l) => ({ ...l, qty: 1 }))); setClient(""); }
    else router.push("/admin/ventas");
  };

  return (
    <AdminPage title="Registrar venta" back={{ href: "/admin/ventas", label: "Ventas" }}>
      <div className="a-head"><div className="stack g1"><BackLink href="/admin/ventas" label="Ventas" /><h1 className="a-h1">Registrar venta</h1><p className="a-sub">Para ventas fuera de la web (DM, ferias, colegios). Las de la web se registran solas.</p></div></div>
      <div className="a-cols">
        <div className="stack g5">
          <section className="a-card" aria-labelledby="vn-ch">
            <h2 className="a-h2" id="vn-ch">Canal</h2>
            <div className="chg" role="radiogroup" aria-labelledby="vn-ch">
              {CH.map(([k, l, desc]) => <button key={k} className={`chb ${chan === k ? "on" : ""}`} type="button" role="radio" aria-checked={chan === k} onClick={() => { setChan(k); if (k === "ig") setDel(true); }}><b>{l}</b><span className="a-cap">{desc}</span></button>)}
            </div>
            {chan === "feria" && <p className="a-cap">Feria: <b>{demo.sales.fair.name}</b> · {demo.sales.fair.dates}</p>}
            <div className="a-grid2">
              <div className="a-field"><label htmlFor="v-fecha">Fecha</label><input id="v-fecha" className="a-input" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
              <div className="a-field"><label htmlFor="v-cli">Cliente <span className="a-cap">(opcional)</span></label><input id="v-cli" className="a-input" placeholder="Nombre o @usuario" value={client} onChange={(e) => setClient(e.target.value)} /></div>
            </div>
          </section>
          <section className="a-card" aria-labelledby="vn-p">
            <div className="a-card-h"><h2 className="a-h2" id="vn-p">Productos</h2><button className="a-btn sm" type="button" onClick={() => products[0] && setLines((ls) => [...ls, { productId: products[0].id, variantId: products[0].variants[0]?.id ?? "", qty: 1, price: products[0].variants[0]?.price ?? 0 }])}><AIPlus size="sm" /> Agregar producto</button></div>
            {lines.map((l, i) => {
              const p = prod(l.productId);
              return (
                <div className="ln" key={i}>
                  <span className="av" style={{ width: 44, height: 44 }}>{p && <img src={asset(bundle.tenant.slug, p.images[0])} alt="" />}</span>
                  <div>
                    <select className="a-select" aria-label="Producto" value={l.productId} onChange={(e) => { const np = prod(e.target.value); upd(i, { productId: e.target.value, variantId: np?.variants[0]?.id ?? "", price: np?.variants[0]?.price ?? 0 }); }}>
                      {products.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                    </select>
                    <p className="a-cap">costo {money(cost(l))} c/u</p>
                  </div>
                  <select className="a-select wide" aria-label="Variante" value={l.variantId} onChange={(e) => upd(i, { variantId: e.target.value, price: p?.variants.find((v) => v.id === e.target.value)?.price ?? l.price })}>
                    {p?.variants.map((v) => <option key={v.id} value={v.id}>{v.label}</option>)}
                  </select>
                  <div className="a-prefix wide"><span>S/</span><input inputMode="decimal" value={l.price} onChange={(e) => upd(i, { price: parseFloat(e.target.value) || 0 })} aria-label="Precio cobrado" /></div>
                  <div className="qty2 wide"><button type="button" aria-label="Restar" onClick={() => upd(i, { qty: Math.max(1, l.qty - 1) })}>−</button><span>{l.qty}</span><button type="button" aria-label="Sumar" onClick={() => upd(i, { qty: l.qty + 1 })}>+</button></div>
                  <button className="a-btn sm ghost" type="button" aria-label="Quitar" style={{ padding: 0, width: 44 }} onClick={() => setLines((ls) => ls.filter((_, j) => j !== i))}><AITrash size="sm" /></button>
                </div>
              );
            })}
            <div className="row between"><div><b>Descontar del stock</b><p className="a-cap">Recomendado si vendiste cajas del inventario</p></div><Switch on={discount} onChange={setDiscount} label="Descontar del stock" /></div>
          </section>
          <section className="a-card" aria-labelledby="vn-d">
            <div className="row between"><h2 className="a-h2" id="vn-d">Delivery</h2><Switch on={del} onChange={setDel} label="Incluye delivery" /></div>
            {del ? (
              <div className="a-grid2">
                <div className="a-field"><label htmlFor="v-dc">Cobrado al cliente</label><div className="a-prefix"><span>S/</span><input id="v-dc" inputMode="decimal" value={dIn} onChange={(e) => setDIn(e.target.value)} /></div></div>
                <div className="a-field"><label htmlFor="v-dk">Costo real</label><div className="a-prefix"><span>S/</span><input id="v-dk" inputMode="decimal" value={dOut} onChange={(e) => setDOut(e.target.value)} /></div></div>
              </div>
            ) : <p className="a-cap">Sin delivery (entrega en mano o recojo).</p>}
            <div className="a-field"><span style={{ fontSize: 13, fontWeight: 600 }}>Medio de pago</span>
              <div className="row g2 wrap-row" role="radiogroup" aria-label="Medio de pago">{PAYS.map((p) => <button key={p} className={`a-chip ${pay === p ? "on" : ""}`} type="button" role="radio" aria-checked={pay === p} onClick={() => setPay(p)}>{p}</button>)}</div>
            </div>
          </section>
        </div>
        <aside className="a-card" style={{ position: "sticky", top: 20 }} aria-label="Resumen">
          <h2 className="a-h2">Resumen</h2>
          <div className="sumrow"><span>Ingresos por productos</span><b className="money">{money(rev)}</b></div>
          <div className="sumrow"><span>Costo de productos</span><span className="money">− {money(cst)}</span></div>
          <div className="sumrow"><span>Delivery (cobrado − costo)</span><span className="money" style={{ color: d >= 0 ? "#1F6B35" : "#B42318" }}>{del ? `${d >= 0 ? "+ " : "− "}${money(Math.abs(d))}` : "—"}</span></div>
          <div className="sumrow big"><span>Contribución</span><span className="money">{money(contrib)}</span></div>
          <p className="a-cap">Margen {rev ? Math.round((contrib / rev) * 100) : 0}% · {units} unidades · canal {CH.find((c) => c[0] === chan)?.[1]}</p>
          <button className="a-btn primary block" type="button" onClick={() => save(false)}>Guardar venta</button>
          <button className="a-btn block" type="button" onClick={() => save(true)}>Guardar y registrar otra</button>
        </aside>
      </div>
    </AdminPage>
  );
}
