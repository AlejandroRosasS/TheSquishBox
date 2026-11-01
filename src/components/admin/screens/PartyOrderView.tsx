"use client";

/* eslint-disable @next/next/no-img-element */
import { asset } from "@/lib/assets";
import { money, PARTY_STATUS } from "@/lib/admin/format";
import { useAdmin, useParty } from "../AdminContext";
import { AdminPage, DemoNote } from "../AdminPage";
import { AICheck, AIInfo, AIWhatsApp } from "../AdminIcons";
import { waTo } from "./OrderView";

/** Detalle de un pedido para fiesta (cotización). Vive dentro de Pedidos: /admin/pedidos/<id>. */
export function PartyOrderView({ id }: { id: string }) {
  const { bundle, toast } = useAdmin();
  const { tenant } = bundle;
  const { requests, update } = useParty();
  const cur = requests.find((r) => r.id === id);
  const label = tenant.customOrder.adminShort ?? tenant.customOrder.adminLabel ?? tenant.customOrder.label;

  if (!cur) {
    return (
      <AdminPage title="Pedido" back={{ href: "/admin/pedidos", label: "Pedidos" }}>
        <h1 className="a-h1">No encontramos este pedido</h1>
      </AdminPage>
    );
  }

  const price = parseFloat(cur.price) || 0;
  const fee = parseFloat(cur.deliveryFee) || 0;
  const first = cur.name.split(" ")[0] ?? "";

  return (
    <AdminPage title={`Pedido ${cur.id}`} back={{ href: "/admin/pedidos", label: "Pedidos" }}>
      <div className="a-head">
        <div className="stack g1">
          <h1 className="a-h1">Pedido {cur.id} <span className="st nuevo" style={{ verticalAlign: "middle" }}>{label}</span></h1>
          <p className="a-sub">Recibido {cur.when} · {tenant.customOrder.description}</p>
        </div>
      </div>
      <div className="stack g5" style={{ maxWidth: 820 }}>
      <section className="stack g5" aria-label={`Detalle de ${cur.name}`}>
        <div className="a-card">
          <div className="a-card-h" style={{ alignItems: "flex-start" }}>
            <div className="stack g1"><p className="a-cap">{cur.id} · {cur.when}</p><h2 className="a-h2" style={{ fontSize: 20 }}>{cur.name}</h2><p className="a-cap">{cur.phone} · {cur.mail}</p></div>
            <span className={`st ${PARTY_STATUS[cur.status][1]}`}>{PARTY_STATUS[cur.status][0]}</span>
          </div>
          <dl className="kv">
            <dt>Cantidad</dt><dd>{cur.qty}</dd>
            <dt>Cada caja</dt><dd>{cur.size}</dd>
            <dt>Extras</dt><dd>{cur.extras}</dd>
            <dt>Temática</dt><dd>{cur.theme}</dd>
            <dt>Fecha</dt><dd>{cur.date}</dd>
            <dt>Entrega</dt><dd>{cur.district}</dd>
          </dl>
          <div style={{ background: "#F5F5F2", borderRadius: 10, padding: "12px 14px" }}><p className="a-label" style={{ marginBottom: 4 }}>Comentarios</p><p>{cur.idea}</p></div>
          {cur.refs.length > 0 && (
            <>
              <p className="a-label">Fotos de referencia ({cur.refs.length})</p>
              <div className="refs">{cur.refs.map((r, i) => <div key={i}><img src={asset(tenant.slug, r)} alt={`Referencia ${i + 1}`} /></div>)}</div>
            </>
          )}
          <div className="row g2 wrap-row">
            {waTo(cur.phone) ? <a className="a-btn wa" href={waTo(cur.phone, `Hola ${first}, te escribimos de ${tenant.name} por tu pedido ${cur.id}.`) ?? "#"} target="_blank" rel="noreferrer"><AIWhatsApp />Responder por WhatsApp</a> : null}
            {cur.status !== "descartada" && <button className="a-btn danger" type="button" onClick={() => { update(cur.id, { status: "descartada" }); toast("Descartado"); }}>Descartar</button>}
          </div>
        </div>

        <div className="a-card">
          <h2 className="a-h2">Cotización</h2>
          <div className="a-grid2">
            <div className="a-field"><label htmlFor="q-p">Precio total</label><div className="a-prefix"><span>S/</span><input id="q-p" inputMode="decimal" value={cur.price} onChange={(e) => update(cur.id, { price: e.target.value })} /></div></div>
            <div className="a-field"><label htmlFor="q-d">Delivery estimado</label><div className="a-prefix"><span>S/</span><input id="q-d" inputMode="decimal" value={cur.deliveryFee} onChange={(e) => update(cur.id, { deliveryFee: e.target.value })} /></div></div>
          </div>
          <div className="a-field"><label htmlFor="q-n">Descripción de la propuesta</label><textarea id="q-n" className="a-textarea" value={cur.proposal} onChange={(e) => update(cur.id, { proposal: e.target.value })} /></div>
          {cur.status === "nueva" && (
            <button className="a-btn" type="button" disabled={!price} onClick={() => { update(cur.id, { status: "cotizada" }); toast("Marcado como cotizado"); }}>Marcar como cotizado y enviar por WhatsApp</button>
          )}
          {cur.status === "cotizada" && (
            <>
              <div className="a-banner info"><AIInfo size="sm" /><span>¿El cliente aceptó? Genera el link de pago por <b>{money(price + fee)}</b>.</span></div>
              <button className="a-btn primary" type="button" onClick={() => { update(cur.id, { status: "aceptada" }); toast("Link de pago generado"); }}>Aceptar y generar link de pago</button>
            </>
          )}
          {cur.status === "aceptada" && (
            <div className="a-banner ok"><AICheck size="sm" /><span>Aceptado. Link de pago: <b>{tenant.domain}/pagar/{cur.id}</b>. Pasa a «Nuevo» cuando se pague.</span></div>
          )}
          {cur.status === "descartada" && <button className="a-btn" type="button" onClick={() => update(cur.id, { status: "nueva" })}>Volver a «Nuevo»</button>}
        </div>
        <DemoNote>Solicitudes de ejemplo. Los cambios se guardan en este navegador.</DemoNote>
      </section>
      </div>
    </AdminPage>
  );
}
