"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useAdmin } from "./AdminContext";
import { useDb } from "./DbContext";
import { Switch } from "./AdminPage";
import { AICheck, AICopy, AIWhatsApp } from "./AdminIcons";
import { waTo } from "./screens/OrderView";
import { ensureOrderRequest, REQUEST_COLUMNS, type RequestRow } from "@/lib/db/reviews";
import { fillTemplate, reviewPath } from "@/lib/reviews";
import { whenShort } from "@/lib/db/orders";

type Props = {
  /** uuid del pedido en la base. */
  orderId: string;
  client: string;
  phone: string;
  email: string;
  productSlugs: string[];
};

/**
 * Reseña de un pedido entregado: botón para pedirla por WhatsApp, estado del correo automático
 * y el interruptor «Pedir reseña» para saltarse a un cliente.
 */
export function OrderReview({ orderId, client, phone, email, productSlugs }: Props) {
  const db = useDb();
  const { bundle, toast } = useAdmin();
  const sf = bundle.storefront.reviews;
  const tenantId = db?.state.phase === "ready" ? db.state.tenantId : null;
  const [blocked, setBlocked] = useState<boolean | null>(null);
  const [req, setReq] = useState<RequestRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [missing, setMissing] = useState(false);

  const load = useCallback(async () => {
    if (!db) return;
    const [o, r] = await Promise.all([
      db.client.from("orders").select("review_blocked").eq("id", orderId).maybeSingle(),
      db.client.from("review_requests").select(REQUEST_COLUMNS).eq("order_id", orderId).maybeSingle(),
    ]);
    if (o.error || r.error) return setMissing(true);
    setBlocked(Boolean(o.data?.review_blocked));
    setReq((r.data as RequestRow | null) ?? null);
  }, [db, orderId]);

  useEffect(() => {
    const t = setTimeout(() => void load(), 0);
    return () => clearTimeout(t);
  }, [load]);

  if (!db || !tenantId || missing || blocked === null) return null;

  const first = client.split(" ")[0];
  const linkOf = (r: RequestRow) => `${window.location.origin}${reviewPath(r.token)}`;

  const setAsk = async (ask: boolean) => {
    const { error } = await db.client.from("orders").update({ review_blocked: !ask }).eq("id", orderId);
    if (error) return toast(`No se pudo guardar: ${error.message}`);
    setBlocked(!ask);
    toast(ask ? "Se le pedirá reseña" : `No se le pedirá reseña a ${first}`);
  };

  const getRequest = async () => {
    const r = req ?? (await ensureOrderRequest(db.client, tenantId, { id: orderId, customer: { name: client, phone, email }, productSlugs }));
    setReq(r);
    return r;
  };

  const sendWhatsApp = async () => {
    // La ventana se abre antes de esperar a la base: si no, el navegador la bloquea.
    const win = window.open("", "_blank");
    setBusy(true);
    try {
      const r = await getRequest();
      const url = waTo(phone, fillTemplate(sf.whatsappMessage, { nombre: first, marca: bundle.tenant.name, link: linkOf(r) }));
      if (!url) throw new Error("El pedido no tiene celular.");
      if (win) win.location.href = url;
      else window.location.href = url;
      const now = new Date().toISOString();
      await db.client.from("review_requests").update({ whatsapp_at: now }).eq("id", r.id);
      setReq({ ...r, whatsapp_at: now });
    } catch (e) {
      win?.close();
      toast(e instanceof Error ? e.message : "No se pudo preparar el link");
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    try {
      const r = await getRequest();
      await navigator.clipboard?.writeText(linkOf(r));
      toast("Link copiado");
    } catch (e) {
      toast(e instanceof Error ? e.message : "No se pudo copiar el link");
    }
  };

  const status = req?.submitted_at
    ? `${first} dejó su reseña el ${whenShort(req.submitted_at)}.`
    : [req?.whatsapp_at && `WhatsApp abierto el ${whenShort(req.whatsapp_at)}`, req?.email_at && `correo enviado el ${whenShort(req.email_at)}`].filter(Boolean).join(" · ");

  return (
    <section className="a-card stack g3" aria-labelledby="o-rev">
      <div className="a-card-h">
        <h2 className="a-h2" id="o-rev">Reseña</h2>
        <div className="row g2" style={{ alignItems: "center" }}>
          <span className="a-cap">Pedir reseña</span>
          <Switch on={!blocked} onChange={(v) => void setAsk(v)} label={`Pedirle reseña a ${first}`} />
        </div>
      </div>
      {blocked ? (
        <p className="a-cap" style={{ margin: 0 }}>No le pediremos reseña a {first}: no le sale el botón ni le llega el correo automático.</p>
      ) : req?.submitted_at ? (
        <div className="a-banner ok"><AICheck size="sm" /><span>{status} <Link href="/admin/resenas">Revisar en Reseñas</Link></span></div>
      ) : (
        <>
          <p className="a-cap" style={{ margin: 0 }}>
            {email ? `Si ${first} no la deja antes, a los 3 días de entregado le llega un correo con el link.` : `${first} no dejó correo: pídesela por WhatsApp.`}
            {status ? ` ${status.charAt(0).toUpperCase()}${status.slice(1)}.` : ""}
          </p>
          <div className="row g2 wrap-row">
            {phone ? (
              <button className="a-btn wa" type="button" disabled={busy} onClick={() => void sendWhatsApp()}><AIWhatsApp />{busy ? "Preparando…" : "Pedir reseña por WhatsApp"}</button>
            ) : null}
            <button className="a-btn" type="button" onClick={() => void copy()}><AICopy size="sm" />Copiar link</button>
          </div>
        </>
      )}
    </section>
  );
}
