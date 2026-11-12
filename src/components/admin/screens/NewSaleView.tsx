"use client";

/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { asset } from "@/lib/assets";
import { money } from "@/lib/admin/format";
import { useAdmin, useAdminCatalog } from "../AdminContext";
import { AdminPage, BackLink, Switch } from "../AdminPage";
import { AIPlus, AITrash } from "../AdminIcons";
import { limaToday, newRef, useManualSales, type ManualSale } from "../AdminSales";
import { useDb } from "../DbContext";
import { useCampaigns } from "../AdminCampaigns";
import { bestCampaign, limaToIso } from "@/lib/campaigns";
import { PAY_METHODS } from "@/lib/sales/csv";
import { fairOn, fairRange } from "@/lib/fairs";
import { useFairs } from "../AdminFairs";

const CH: [string, string, string][] = [["ig", "Instagram", "Venta por DM o WhatsApp"], ["feria", "Feria o evento", "Asociada a una feria"], ["otros", "Otros", "Colegios, referidos, empresas"]];
const PAYS = PAY_METHODS;

export function NewSaleView() {
  const { bundle, demo, toast } = useAdmin();
  const { catalog } = useAdminCatalog();
  const { add } = useManualSales();
  const [saving, setSaving] = useState(false);
  const router = useRouter();
  const products = catalog.products.filter((p) => p.status !== "draft" || p.variants.length);
  const [chan, setChan] = useState("feria");
  const [date, setDate] = useState(demo.today);
  // Con la base, la fecha por defecto es hoy (hora de Perú); la de ejemplo es solo para la demo.
  const live = !!useDb();
  // eslint-disable-next-line react-hooks/set-state-in-effect -- la fecha es solo del navegador
  useEffect(() => { if (live) setDate(limaToday()); }, [live]);
  const [client, setClient] = useState("");
  const { campaigns } = useCampaigns();
  const { fairs } = useFairs();
  const fair = fairOn(fairs, date);
  /** Precio del día de la venta: el de la campaña vigente ese día (a mediodía, hora de Perú) o el regular. */
  const priced = (productId: string, variantId: string, day = date) => {
    const regular = catalog.products.find((p) => p.id === productId)?.variants.find((v) => v.id === variantId)?.price ?? 0;
    const b = /^\d{4}-\d{2}-\d{2}$/.test(day) ? bestCampaign(campaigns, productId, variantId, Date.parse(limaToIso(`${day}T12:00`))) : null;
    return b && b.price < regular
      ? { productId, variantId, price: b.price, campaignId: b.campaign.id, campaign: b.campaign.name, listPrice: regular }
      : { productId, variantId, price: regular, campaignId: undefined, campaign: undefined, listPrice: undefined };
  };
  const [lines, setLines] = useState<ManualSale["lines"]>(() => (products[0] ? [{ productId: products[0].id, variantId: products[0].variants[0]?.id ?? "", qty: 1, price: products[0].variants[0]?.price ?? 0 }] : []));
  // Las campañas llegan después del primer render: aplicar su precio a las líneas que siguen con el precio regular.
  const [campaignsSeen, setCampaignsSeen] = useState(campaigns);
  if (campaignsSeen !== campaigns) {
    setCampaignsSeen(campaigns);
    setLines((ls) => ls.map((l) => {
      const np = priced(l.productId, l.variantId);
      return l.campaignId || l.price !== (np.listPrice ?? np.price) ? l : { ...l, ...np };
    }));
  }
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

  const save = async (again: boolean) => {
    if (!lines.length) return toast("Agrega al menos un producto");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return toast("Elige la fecha de la venta");
    setSaving(true);
    const ok = await add([{ ref: newRef(), day: date, channel: chan, client: client.trim(), pay, lines, dIn: del ? parseFloat(dIn) || 0 : 0, dOut: del ? parseFloat(dOut) || 0 : 0, note: "" }], "admin");
    setSaving(false);
    if (!ok) return;
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
            {chan === "feria" && (fair
              ? <p className="a-cap">Se carga en la feria <b>{fair.name}{fair.place ? ` · ${fair.place}` : ""}</b> · {fairRange(fair)}</p>
              : <p className="a-cap">No hay ninguna feria en esa fecha. <Link href="/admin/ventas#v-fair">Crea la feria</Link> y esta venta se cargará sola.</p>)}
            <div className="a-grid2">
              <div className="a-field"><label htmlFor="v-fecha">Fecha</label><input id="v-fecha" className="a-input" type="date" value={date} onChange={(e) => { const day = e.target.value; setDate(day); setLines((ls) => ls.map((l) => ({ ...l, ...priced(l.productId, l.variantId, day) }))); }} /></div>
              <div className="a-field"><label htmlFor="v-cli">Cliente <span className="a-cap">(opcional)</span></label><input id="v-cli" className="a-input" placeholder="Nombre o @usuario" value={client} onChange={(e) => setClient(e.target.value)} /></div>
            </div>
          </section>
          <section className="a-card" aria-labelledby="vn-p">
            <div className="a-card-h"><h2 className="a-h2" id="vn-p">Productos</h2><button className="a-btn sm" type="button" onClick={() => products[0] && setLines((ls) => [...ls, { qty: 1, ...priced(products[0].id, products[0].variants[0]?.id ?? "") }])}><AIPlus size="sm" /> Agregar producto</button></div>
            {lines.map((l, i) => {
              const p = prod(l.productId);
              return (
                <div className="ln" key={i}>
                  <span className="av" style={{ width: 44, height: 44 }}>{p && <img src={asset(bundle.tenant.slug, p.images[0])} alt="" />}</span>
                  <div>
                    <select className="a-select" aria-label="Producto" value={l.productId} onChange={(e) => { const np = prod(e.target.value); upd(i, priced(e.target.value, np?.variants[0]?.id ?? "")); }}>
                      {products.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                    </select>
                    <p className="a-cap">costo {money(cost(l))} c/u{l.campaign ? ` · campaña «${l.campaign}» (regular ${money(l.listPrice ?? 0)})` : ""}</p>
                  </div>
                  <select className="a-select wide" aria-label="Variante" value={l.variantId} onChange={(e) => upd(i, priced(l.productId, e.target.value))}>
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
          <button className="a-btn primary block" type="button" disabled={saving} onClick={() => void save(false)}>Guardar venta</button>
          <button className="a-btn block" type="button" disabled={saving} onClick={() => void save(true)}>Guardar y registrar otra</button>
        </aside>
      </div>
    </AdminPage>
  );
}
