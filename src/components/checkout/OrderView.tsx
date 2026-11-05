"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useStore } from "@/components/StoreContext";
import { Logo } from "@/components/Logo";
import { Rich } from "@/components/Rich";
import { asset } from "@/lib/assets";
import { fill, formatPrice, whatsappLink } from "@/lib/format";
import { findOrder, formatDate, type Order } from "@/lib/orders";
import { IconChat, IconCheck, IconInfo, IconList, IconTruck } from "@/components/Icons";

/* eslint-disable @next/next/no-img-element */

const PAY_NAMES: Record<string, string> = { yape: "Yape", tarjeta: "tarjeta" };

export function OrderView({ id }: { id: string }) {
  const { tenant, storefront: sf } = useStore();
  const [order, setOrder] = useState<Order | null | undefined>(undefined);
  const cur = tenant.currency;

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- el pedido de la demo vive en localStorage
    setOrder(findOrder(tenant.slug, id));
  }, [tenant.slug, id]);

  const header = (
    <header className="header">
      <div className="wrap row" style={{ minHeight: 76, justifyContent: "center" }}>
        <Logo tenant={tenant} size="sm" href="/" />
      </div>
    </header>
  );

  if (order === undefined) return <>{header}<div style={{ minHeight: "60vh" }} /></>;

  if (order === null) {
    return (
      <>
        {header}
        <div className="wrap" style={{ paddingBlock: "72px 112px" }}>
          <div className="stack g4" style={{ maxWidth: 560, margin: "0 auto", textAlign: "center", alignItems: "center" }}>
            <h1 className="h2">No encontramos el pedido N.º {id}</h1>
            <p className="lead">Si acabas de comprar, revisa el correo con tu resumen o escríbenos por WhatsApp.</p>
            <Link className="btn" href="/">Ir al inicio</Link>
          </div>
        </div>
      </>
    );
  }

  const firstName = order.customer.name.split(" ")[0];
  const s = order.shipping;
  // Yape es manual: el pedido queda por confirmar hasta que el equipo vea la captura.
  const yapePending = order.payment.method === "yape";
  const yape = tenant.payments.yape;
  const wa = whatsappLink(
    tenant.whatsapp,
    yapePending
      ? `Hola, hice el pedido N.º ${order.id} en la web y te envío la captura de mi Yape por ${formatPrice(order.total, cur)}.`
      : `Hola, hice el pedido N.º ${order.id} en la web.`,
  );
  const dateText = s.date ? formatDate(s.date, { weekday: "short", day: "numeric", month: "short" }) : "";

  return (
    <>
      {header}
      <div className="wrap" style={{ paddingBlock: "56px 96px" }}>
        <div className="split wide-left">
          <div className="stack g5">
            <span style={{ width: 64, height: 64, borderRadius: "50%", background: "var(--primary)", color: "var(--on-primary)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <IconCheck style={{ width: 30, height: 30 }} />
            </span>
            <p className="eyebrow">Pedido N.º {order.id} · {yapePending ? "Pago con Yape por confirmar" : `Pagado con ${PAY_NAMES[order.payment.method] ?? order.payment.method}`}</p>
            <h1 className="h1"><Rich text={fill(sf.confirmation.title, { name: firstName })} /></h1>
            <p className="lead">{fill(sf.confirmation.lead, { email: order.customer.email })}</p>

            <div className="stack g3" style={{ background: "var(--primary-soft)", borderRadius: 20, padding: 24 }}>
              <p className="h4">Próximos pasos</p>
              <ol className="steps" style={{ marginTop: 6, padding: 0, listStyle: "none" }}>
                {yapePending ? (
                  <li className="stp"><span className="b"><IconChat size="sm" /></span><div><b>Envíanos la captura de tu Yape</b><p className="small muted">Yapea {formatPrice(order.total, cur)}{yape?.phone ? ` al ${yape.phone}` : ""} y mándanos la captura por WhatsApp. Cuando la veamos, confirmamos tu pago y empezamos a armar tu pedido.</p></div></li>
                ) : (
                  <li className="stp done"><span className="b"><IconCheck size="sm" /></span><div><b>Pago recibido</b><p className="small muted">Ya estamos armando tu pedido.</p></div></li>
                )}
                <li className="stp"><span className="b"><IconChat size="sm" /></span><div><b>Te escribiremos por WhatsApp</b><p className="small muted">{s.type === "delivery" ? "Para coordinar la entrega y confirmar el costo final del delivery." : "Para coordinar dónde y cuándo recoges tu pedido."}</p></div></li>
                <li className="stp" style={{ paddingBottom: 0 }}><span className="b"><IconTruck size="sm" /></span><div><b>{s.type === "delivery" ? "Entrega" : "Recojo"}</b><p className="small muted">Fecha tentativa: {dateText.replace(/\.$/, "")}. Aún no está confirmada: te escribimos por WhatsApp para confirmarla.</p></div></li>
              </ol>
            </div>
            {s.type === "delivery" && (
              <div className="note accent"><IconInfo size="sm" /><span>Si el delivery real a tu dirección es mayor al estimado, te enviaremos un link para pagar solo la diferencia. Si es menor, te devolvemos la diferencia.</span></div>
            )}
            {sf.confirmation.collectNote && (
              <div className="note"><IconList size="sm" /><span><Rich text={sf.confirmation.collectNote} /></span></div>
            )}
            <div className="row g3 wrap-row">
              {wa ? (
                <a className="btn" href={wa} target="_blank" rel="noreferrer">{yapePending ? "Enviar captura por WhatsApp" : "Escribirnos por WhatsApp"}</a>
              ) : (
                <span className="btn disabled" aria-disabled="true" title={`WhatsApp por definir (${tenant.whatsapp})`}>Escribirnos por WhatsApp</span>
              )}
              <Link className="btn ghost" href="/">Seguir viendo</Link>
            </div>
          </div>

          <aside className="summary" aria-label="Resumen del pedido">
            <p className="h4">Resumen</p>
            {order.lines.map((l) => (
              <div className="row g3" key={`${l.productId}/${l.variantLabel}`}>
                <div className="ph r45" style={{ width: 56, flex: "none", borderRadius: 10 }}><img src={asset(tenant.slug, l.image)} alt={l.name} /></div>
                <div className="grow"><b style={{ fontSize: 14 }}>{l.name}</b><p className="small muted">{l.variantLabel ? `${l.variantLabel} · ` : ""}x{l.qty}</p></div>
                <span className="small strong">{formatPrice(l.price * l.qty, cur)}</span>
              </div>
            ))}
            <hr className="hr" />
            <div className="sum-row"><span className="muted">Subtotal</span><span>{formatPrice(order.subtotal, cur)}</span></div>
            {s.type === "delivery" ? (
              <div className="sum-row"><span className="muted">Delivery estimado · {s.district}</span><span>{order.deliveryFee == null ? "A coordinar" : formatPrice(order.deliveryFee, cur)}</span></div>
            ) : (
              <div className="sum-row"><span className="muted">Recojo acordado</span><span>Gratis</span></div>
            )}
            <div className="sum-row total"><span>{yapePending ? "Total a yapear" : "Total pagado"}</span><span>{formatPrice(order.total, cur)}</span></div>
            <hr className="hr" />
            <div className="stack g2 small">
              {s.type === "delivery" && (
                <div className="sum-row"><span className="muted">Entrega</span><span style={{ textAlign: "right" }}>{s.address}, {s.district}</span></div>
              )}
              {s.type === "delivery" && s.gift && (
                <div className="sum-row"><span className="muted">Mensaje de regalo</span><span style={{ textAlign: "right" }}>“{s.gift.length > 24 ? `${s.gift.slice(0, 24)}…` : s.gift}”</span></div>
              )}
              <div className="sum-row"><span className="muted">Comprobante</span><span>{order.doc.type === "boleta" ? "Boleta" : "Factura"}</span></div>
            </div>
          </aside>
        </div>
      </div>
    </>
  );
}
