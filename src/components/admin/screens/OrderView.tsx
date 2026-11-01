"use client";

/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { use, useState } from "react";
import { asset } from "@/lib/assets";
import { whatsappLink } from "@/lib/format";
import { money, ORDER_STATUS } from "@/lib/admin/format";
import type { OrderStatus } from "@/lib/admin/types";
import { useAdmin, useAdminCatalog, useOrders } from "../AdminContext";
import { AdminPage, BackLink, DemoNote } from "../AdminPage";
import { AIAlert, AICheck, AIInfo, AILink, AIWhatsApp } from "../AdminIcons";
import { deliveryState, orderTotal } from "./OrdersView";

const FLOW: OrderStatus[] = ["nuevo", "prep", "listo", "entregado"];

export function waTo(phone: string, text?: string) {
  const digits = phone.replace(/\D/g, "");
  return whatsappLink(digits.length === 9 ? `+51${digits}` : phone, text);
}

export function OrderView({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { bundle, toast } = useAdmin();
  const { tenant } = bundle;
  const { orders, update, hydrated } = useOrders();
  const { catalog } = useAdminCatalog();
  const [note, setNote] = useState("");
  const [realText, setRealText] = useState<string | null>(null);
  const o = orders.find((x) => x.id === id);

  if (!o) {
    return (
      <AdminPage title="Pedido" back={{ href: "/admin/pedidos", label: "Pedidos" }}>
        <h1 className="a-h1">{hydrated ? "No encontramos este pedido" : "Cargando…"}</h1>
      </AdminPage>
    );
  }

  const now = () => "Ahora";
  const addLog = (t: string) => [{ t, when: now() }, ...o.log];
  const [sl, sc] = ORDER_STATUS[o.status];
  const idx = FLOW.indexOf(o.status);
  const subtotal = o.lines.reduce((s, l) => s + l.price * l.qty, 0);
  const has = o.deliveryReal !== null && o.deliveryReal !== undefined;
  const diff = has ? Math.round(((o.deliveryReal as number) - o.deliveryFee) * 100) / 100 : 0;
  const abs = money(Math.abs(diff));
  const [dl, dc] = deliveryState(o);
  const first = o.client.split(" ")[0];
  const wa = waTo(o.phone, `Hola ${first}, te escribimos de ${tenant.name} por tu pedido #${o.id}.`);
  const isPickup = o.district.toLowerCase().includes("recojo");
  const payLink = `${tenant.domain}/pagar/${o.id}-dif`;

  const setReal = (v: string) => {
    setRealText(v);
    const n = parseFloat(v.replace(",", "."));
    update(o.id, { deliveryReal: v.trim() === "" || !Number.isFinite(n) ? null : n, link: "none", refund: "none" });
  };

  const product = (pid: string) => catalog.products.find((p) => p.id === pid);
  const lineLabel = (pid: string) => catalog.lines.find((l) => l.id === product(pid)?.line)?.name ?? "";

  return (
    <AdminPage title={`Pedido #${o.id}`} back={{ href: "/admin/pedidos", label: "Pedidos" }} topRight={<span className={`st ${sc}`}>{sl}</span>}>
      <div className="a-head">
        <div className="stack g1">
          <BackLink href="/admin/pedidos" label="Pedidos" />
          <div className="row g3 wrap-row"><h1 className="a-h1">Pedido #{o.id}</h1><span className={`st ${sc}`}>{sl}</span><span className={`st ${o.payment === "Devuelto" ? "devuelto" : "pagado"}`}>{o.payment}</span></div>
          <p className="a-sub">{o.createdAt} · {o.client}</p>
        </div>
        <div className="row g2 wrap-row">
          {wa ? <a className="a-btn wa" href={wa} target="_blank" rel="noreferrer"><AIWhatsApp />Escribir por WhatsApp</a> : <button className="a-btn" type="button" disabled>WhatsApp sin número</button>}
          <button className="a-btn" type="button" onClick={() => window.print()}>Imprimir tarjeta</button>
        </div>
      </div>

      <section className="a-card" aria-labelledby="o-st">
        <div className="a-card-h">
          <h2 className="a-h2" id="o-st">Estado del pedido</h2>
          {o.status !== "cancelado" ? (
            <button className="a-btn sm ghost danger" type="button" onClick={() => { update(o.id, { status: "cancelado", log: addLog("Pedido cancelado") }); toast("Pedido cancelado"); }}>Cancelar pedido</button>
          ) : (
            <button className="a-btn sm" type="button" onClick={() => update(o.id, { status: "nuevo", log: addLog("Pedido reactivado") })}>Reactivar</button>
          )}
        </div>
        <div className="stepper" role="group" aria-label="Cambiar estado">
          {FLOW.map((k, i) => (
            <button key={k} type="button" className={i === idx ? "on" : i < idx ? "done" : ""} aria-pressed={i === idx}
              onClick={() => { update(o.id, { status: k, log: addLog(`Estado cambiado a «${ORDER_STATUS[k][0]}»`) }); toast(`Pedido #${o.id}: ${ORDER_STATUS[k][0]}`); }}>
              {ORDER_STATUS[k][0]}
            </button>
          ))}
        </div>
        {o.status === "entregado" && (
          <div className="a-banner ok"><AICheck size="sm" /><span><b>Pedido entregado.</b> Le enviamos a {first} un mensaje de agradecimiento con el link para compartir su unboxing y etiquetar a @{tenant.instagram}.</span></div>
        )}
        {o.status === "cancelado" && <div className="a-banner warn"><AIAlert size="sm" /><span>Pedido cancelado. Si ya estaba pagado, registra la devolución al cliente.</span></div>}
      </section>

      <div className="a-cols">
        <div className="stack g5">
          {!isPickup && (
            <section className="a-card" aria-labelledby="o-del">
              <div className="a-card-h"><h2 className="a-h2" id="o-del">Delivery</h2><span className={`st ${dc}`}>{dl}</span></div>
              <div className="dl">
                <div><span className="a-cap">Estimado cobrado</span><b className="money">{money(o.deliveryFee)}</b><span className="a-cap">{o.district}</span></div>
                <div><span className="a-cap">Real</span><b className="money">{has ? money(o.deliveryReal as number) : "—"}</b><span className="a-cap">{has ? "Registrado" : "Pendiente"}</span></div>
                <div><span className="a-cap">Diferencia</span><b className={`money ${!has ? "" : diff > 0 ? "delta-up" : diff < 0 ? "delta-down" : "delta-zero"}`}>{has ? `${diff > 0 ? "+ " : diff < 0 ? "− " : ""}${abs}` : "—"}</b><span className="a-cap">{!has ? "Registra el costo real" : diff > 0 ? "Cobrar al cliente" : diff < 0 ? "Devolver al cliente" : "Todo cuadra"}</span></div>
              </div>
              <div className="a-grid2" style={{ alignItems: "end" }}>
                <div className="a-field"><label htmlFor="d-real">Costo real del delivery</label><div className="a-prefix"><span>S/</span><input id="d-real" inputMode="decimal" placeholder="0.00" value={realText ?? (has ? String(o.deliveryReal) : "")} onChange={(e) => setReal(e.target.value)} onBlur={() => setRealText(null)} /></div></div>
                <div className="row g2 wrap-row"><span className="a-cap">Rápido:</span>
                  {[o.deliveryFee - 2, o.deliveryFee, o.deliveryFee + 5].filter((n) => n >= 0).map((n) => (
                    <button key={n} className="a-chip" type="button" onClick={() => { setReal(String(n)); setRealText(null); }}>{money(n).replace(".00", "")}</button>
                  ))}
                </div>
              </div>
              {has && diff > 0 && o.link === "none" && (
                <div className="stack g3">
                  <div className="a-banner warn"><AIAlert size="sm" /><span>El delivery real salió <b>{abs} más</b> que lo cobrado. Genera un link para que {first} pague solo la diferencia.</span></div>
                  <button className="a-btn primary block" type="button" onClick={() => update(o.id, { link: "pend", log: addLog(`Link de pago por diferencia generado · ${abs}`) })}><AILink size="sm" />Generar link de pago por diferencia · {abs}</button>
                </div>
              )}
              {has && diff > 0 && o.link !== "none" && (
                <div className="stack g3">
                  <div className="linkbox"><AILink size="sm" /><span>{payLink}</span><button className="a-btn sm" type="button" onClick={() => { navigator.clipboard?.writeText(payLink); toast("Link copiado"); }}>Copiar</button></div>
                  <div className="row g2 wrap-row">
                    {wa && <a className="a-btn wa grow" href={waTo(o.phone, `Hola ${first}, el delivery de tu pedido #${o.id} costó ${abs} más. Puedes pagar la diferencia aquí: ${payLink}`) ?? "#"} target="_blank" rel="noreferrer"><AIWhatsApp />Enviar link por WhatsApp</a>}
                    {o.link === "pend" && <button className="a-btn grow" type="button" onClick={() => update(o.id, { link: "pagado", log: addLog(`Diferencia pagada · ${abs}`) })}>Simular pago recibido</button>}
                  </div>
                  <p className="a-cap">El estado cambia a «Pagado» solo cuando la pasarela confirma el pago, y te llega una alerta.</p>
                </div>
              )}
              {has && diff < 0 && o.refund !== "devuelto" && (
                <div className="stack g3">
                  <div className="a-banner info"><AIInfo size="sm" /><span>El delivery real salió <b>{abs} menos</b>. Registra la devolución a {first}.</span></div>
                  {o.refund === "none" && <button className="a-btn primary block" type="button" onClick={() => update(o.id, { refund: "pend", log: addLog(`Devolución registrada · ${abs}`) })}>Registrar devolución · {abs}</button>}
                  {o.refund === "pend" && <button className="a-btn block" type="button" onClick={() => update(o.id, { refund: "devuelto", log: addLog(`Devolución realizada · ${abs}`) })}>Marcar como devuelto</button>}
                </div>
              )}
              {has && diff === 0 && <div className="a-banner ok"><AICheck size="sm" /><span>El costo real coincide con lo cobrado. No hay diferencia.</span></div>}
            </section>
          )}

          <section className="a-card" aria-labelledby="o-prod">
            <h2 className="a-h2" id="o-prod">Productos</h2>
            {o.lines.map((l, i) => {
              const p = product(l.productId);
              const v = p?.variants.find((x) => x.id === l.variantId);
              return (
                <div className="row g3" key={i}>
                  <span className="av lg">{p && <img src={asset(tenant.slug, p.images[0])} alt="" />}</span>
                  <div className="grow"><b>{p?.name ?? l.productId}</b><p className="a-cap">{lineLabel(l.productId)} · <b>{v?.label}</b> · x{l.qty}</p></div>
                  <span className="money" style={{ fontWeight: 700 }}>{money(l.price * l.qty)}</span>
                </div>
              );
            })}
            <hr className="a-hr" />
            <dl className="kv" style={{ gridTemplateColumns: "minmax(0, 1fr) auto" }}>
              <dt>Subtotal</dt><dd className="money">{money(subtotal)}</dd>
              <dt>{isPickup ? "Recojo" : "Delivery estimado"}</dt><dd className="money">{money(o.deliveryFee)}</dd>
              <dt><b style={{ color: "var(--a-text)" }}>Total cobrado</b></dt><dd className="money"><b>{money(orderTotal(o))}</b></dd>
            </dl>
          </section>
        </div>

        <div className="stack g5">
          <section className="a-card" aria-labelledby="o-cli">
            <h2 className="a-h2" id="o-cli">Cliente y entrega</h2>
            <dl className="kv">
              <dt>Cliente</dt><dd>{o.client}</dd>
              <dt>Celular</dt><dd>{o.phone}</dd>
              {o.email && <><dt>Correo</dt><dd>{o.email}</dd></>}
              {o.address && <><dt>Dirección</dt><dd>{o.address}</dd></>}
              {o.reference && <><dt>Referencia</dt><dd>{o.reference}</dd></>}
              <dt>{isPickup ? "Entrega" : "Fecha preferida"}</dt><dd>{isPickup ? `${o.district} · ${o.date}` : o.date}</dd>
              <dt>Comprobante</dt><dd>{o.doc}</dd>
            </dl>
            {o.gift && <div className="gift-note"><p className="a-label" style={{ marginBottom: 4 }}>Mensaje para la tarjeta</p><p>“{o.gift}”</p></div>}
          </section>
          <section className="a-card" aria-labelledby="o-notes">
            <h2 className="a-h2" id="o-notes">Notas internas</h2>
            <textarea className="a-textarea" placeholder="Solo las ve el equipo" aria-label="Nueva nota interna" value={note} onChange={(e) => setNote(e.target.value)} />
            <button className="a-btn sm" type="button" style={{ alignSelf: "flex-start" }} disabled={!note.trim()} onClick={() => { update(o.id, { notes: [{ who: "Equipo", when: "ahora", text: note.trim() }, ...o.notes] }); setNote(""); }}>Agregar nota</button>
            <div className="log">
              {o.notes.map((n, i) => <div key={i}><i /><span><b>{n.who}</b> · {n.when}<br />{n.text}</span></div>)}
            </div>
          </section>
          <section className="a-card" aria-labelledby="o-log">
            <h2 className="a-h2" id="o-log">Actividad</h2>
            <div className="log">
              {o.log.map((l, i) => <div key={i}><i className="on" /><span>{l.t}<br /><span className="a-cap">{l.when}</span></span></div>)}
              {!o.log.length && <p className="a-cap">Sin actividad registrada.</p>}
            </div>
          </section>
          <DemoNote>Pedido de ejemplo. Los cambios se guardan en este navegador.</DemoNote>
          <Link className="a-btn ghost sm" href="/admin/pedidos" style={{ alignSelf: "flex-start" }}>← Volver a pedidos</Link>
        </div>
      </div>
    </AdminPage>
  );
}
