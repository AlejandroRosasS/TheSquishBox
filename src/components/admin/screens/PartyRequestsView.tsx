"use client";

/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { useState } from "react";
import { asset } from "@/lib/assets";
import { money, PARTY_STATUS } from "@/lib/admin/format";
import { useAdmin, useParty } from "../AdminContext";
import { AdminPage, DemoNote } from "../AdminPage";
import { AIBell, AICheck, AIInfo, AIWhatsApp } from "../AdminIcons";
import { waTo } from "./OrderView";

export function PartyRequestsView() {
  const { bundle, toast } = useAdmin();
  const { tenant } = bundle;
  const { requests, update } = useParty();
  const [f, setF] = useState("all");
  const [selId, setSelId] = useState(requests[0]?.id);
  const label = tenant.customOrder.adminLabel ?? tenant.customOrder.label;
  const list = requests.filter((r) => f === "all" || r.status === f);
  const cur = requests.find((r) => r.id === selId) ?? list[0];
  const nNew = requests.filter((r) => r.status === "nueva").length;
  const defs: [string, string][] = [["all", "Todos"], ["nueva", "Nuevo"], ["cotizada", "Cotizado"], ["aceptada", "Aceptado"], ["descartada", "Descartado"]];

  if (!tenant.customOrder.enabled) {
    return <AdminPage title={label}><h1 className="a-h1">Esta marca no tiene pedidos especiales</h1><p className="a-sub">Actívalos en Ajustes.</p></AdminPage>;
  }

  const price = cur ? parseFloat(cur.price) || 0 : 0;
  const fee = cur ? parseFloat(cur.deliveryFee) || 0 : 0;
  const first = cur?.name.split(" ")[0] ?? "";

  return (
    <AdminPage title={tenant.customOrder.adminShort ?? label} topRight={<Link className="a-btn ghost sm" href="/admin/notificaciones" aria-label="Notificaciones"><AIBell /></Link>}>
      <div className="a-head"><div className="stack g1"><h1 className="a-h1">{label}</h1><p className="a-sub">{nNew} nuevos por cotizar · {tenant.customOrder.description}</p></div></div>
      <div className="a-scroll-x" role="group" aria-label="Filtrar">
        {defs.map(([k, l]) => (
          <button key={k} className={`a-chip ${f === k ? "on" : ""}`} type="button" aria-pressed={f === k} onClick={() => setF(k)}>
            {l} <span className="n">{k === "all" ? requests.length : requests.filter((r) => r.status === k).length}</span>
          </button>
        ))}
      </div>
      <div className="sol-cols">
        <section className="a-card flush" aria-label={`Lista de ${label.toLowerCase()}`}>
          {list.map((r) => {
            const [sl, sc] = PARTY_STATUS[r.status];
            return (
              <button key={r.id} className={`req ${cur?.id === r.id ? "on" : ""}`} type="button" aria-pressed={cur?.id === r.id} onClick={() => setSelId(r.id)}>
                <span className="av"><img src={asset(tenant.slug, r.img)} alt="" /></span>
                <span className="stack grow" style={{ gap: 2 }}>
                  <span className="row between g2"><b>{r.name}</b><span className="a-cap">{r.when}</span></span>
                  <span className="a-cap">{r.qty} · {r.size} · {r.date}</span>
                  <span style={{ marginTop: 4 }}><span className={`st ${sc}`}>{sl}</span></span>
                </span>
              </button>
            );
          })}
          {!list.length && <p className="a-cap" style={{ padding: 16 }}>Nada por aquí.</p>}
        </section>

        {cur && (
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
                  <div className="a-banner info"><AIInfo size="sm" /><span>¿El cliente aceptó? Conviértelo en pedido: se crea con estos datos y se genera un link de pago por <b>{money(price + fee)}</b>.</span></div>
                  <button className="a-btn primary" type="button" onClick={() => { update(cur.id, { status: "aceptada" }); toast("Pedido creado"); }}>Convertir en pedido con link de pago</button>
                </>
              )}
              {cur.status === "aceptada" && (
                <div className="a-banner ok"><AICheck size="sm" /><span>Convertido en pedido. Link: <b>{tenant.domain}/pagar/{cur.id}</b>. Pasa a «Nuevo» en Pedidos cuando se pague.</span></div>
              )}
              {cur.status === "descartada" && <button className="a-btn" type="button" onClick={() => update(cur.id, { status: "nueva" })}>Volver a «Nuevo»</button>}
            </div>
            <DemoNote>Solicitudes de ejemplo. Los cambios se guardan en este navegador.</DemoNote>
          </section>
        )}
      </div>
    </AdminPage>
  );
}
