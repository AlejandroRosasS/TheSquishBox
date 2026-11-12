"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { useStore } from "@/components/StoreContext";
import { IconAlert, IconCheck, IconPrint } from "@/components/Icons";
import { fileComplaint } from "@/lib/db/complaints";
import {
  businessOf, COMPLAINT_DEFS, COMPLAINT_NOTES, complaintCode, LEGAL_ROUTES, loadDemoComplaints, RESPONSE_BUSINESS_DAYS, saveDemoComplaints,
  type Complaint, type ComplaintInput,
} from "@/lib/legal";
import { ComplaintSheet } from "./ComplaintSheet";
import { Rich } from "@/components/Rich";

const EMPTY: ComplaintInput = {
  consumer: { name: "", docType: "DNI", docNumber: "", address: "", phone: "", email: "", guardian: "" },
  item: { type: "producto", description: "", amount: "", orderNumber: "" },
  kind: "reclamo",
  detail: "",
  request: "",
};

const fieldset = { border: 0, padding: 0, margin: 0 } as const;

/** Hoja de reclamación virtual: se registra en la base con número correlativo y muestra la constancia. */
export function ComplaintForm() {
  const { tenant, storefront: sf, source } = useStore();
  const b = businessOf(tenant, sf);
  const [f, setF] = useState<ComplaintInput>(EMPTY);
  const [minor, setMinor] = useState(false);
  const [agree, setAgree] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState("");
  const [done, setDone] = useState<Complaint | null>(null);

  const setC = (patch: Partial<ComplaintInput["consumer"]>) => setF((x) => ({ ...x, consumer: { ...x.consumer, ...patch } }));
  const setI = (patch: Partial<ComplaintInput["item"]>) => setF((x) => ({ ...x, item: { ...x.item, ...patch } }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const c = f.consumer;
    const er: Record<string, string> = {};
    if (c.name.trim().length < 3) er.name = "Escribe tu nombre completo.";
    const docDigits = c.docNumber.replace(/\s/g, "");
    if (c.docType === "DNI" ? !/^\d{8}$/.test(docDigits) : docDigits.length < 6) er.doc = c.docType === "DNI" ? "El DNI tiene 8 dígitos." : "Revisa el número de documento.";
    if (c.address.trim().length < 5) er.address = "Escribe tu domicilio.";
    if (!/^\S+@\S+\.\S+$/.test(c.email.trim())) er.email = "Escribe un correo válido: ahí te enviaremos la respuesta.";
    if (minor && c.guardian.trim().length < 3) er.guardian = "Escribe el nombre del padre, madre o apoderado.";
    if (f.item.amount.trim() && !(Number(f.item.amount.replace(",", ".")) >= 0)) er.amount = "Escribe un monto válido.";
    if (f.item.description.trim().length < 3) er.description = "Cuéntanos qué producto o servicio es.";
    if (f.detail.trim().length < 10) er.detail = "Cuéntanos qué pasó (al menos 10 caracteres).";
    if (f.request.trim().length < 3) er.request = "Cuéntanos qué solución esperas.";
    if (!agree) er.agree = "Marca la casilla para continuar.";
    setErrors(er);
    if (Object.keys(er).length) {
      document.getElementById(`lr-${Object.keys(er)[0]}`)?.focus();
      return;
    }

    const input: ComplaintInput = {
      consumer: { ...c, name: c.name.trim(), docNumber: docDigits, address: c.address.trim(), phone: c.phone.trim(), email: c.email.trim(), guardian: minor ? c.guardian.trim() : "" },
      item: { ...f.item, description: f.item.description.trim(), amount: f.item.amount.trim(), orderNumber: f.item.orderNumber.trim() },
      kind: f.kind,
      detail: f.detail.trim(),
      request: f.request.trim(),
    };
    const provider = { legalName: b.legalName, ruc: b.ruc, address: b.address };
    setSending(true);
    setSendError("");
    try {
      let saved: Complaint;
      if (source === "db") {
        const r = await fileComplaint(tenant.slug, input, provider);
        saved = { ...input, ...r, status: "open", response: "", respondedAt: null };
      } else {
        // Demo sin base de datos: la hoja queda en este navegador y se ve en el admin.
        const list = loadDemoComplaints(tenant.slug);
        const now = new Date();
        const year = now.getFullYear();
        const n = list.filter((x) => x.code.endsWith(`-${year}`)).length + 1;
        saved = { ...input, id: `demo-${now.getTime()}`, code: complaintCode(n, year), createdAt: now.toISOString(), provider, status: "open", response: "", respondedAt: null };
        saveDemoComplaints(tenant.slug, [saved, ...list]);
      }
      setDone(saved);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      setSendError("No pudimos registrar tu hoja. Revisa tu conexión e inténtalo otra vez.");
    } finally {
      setSending(false);
    }
  };

  if (done) {
    return (
      <div className="wrap" style={{ paddingBlock: "48px 96px" }}>
        <div className="stack g5" style={{ maxWidth: 760, margin: "0 auto" }}>
          <div className="row g3 no-print" role="status">
            <span className="ok-dot"><IconCheck size="sm" /></span>
            <div className="stack g1">
              <h1 className="h3">Registramos tu hoja N.º {done.code}</h1>
              <p className="muted">
                Te responderemos a <b>{done.consumer.email}</b> en un plazo máximo de {RESPONSE_BUSINESS_DAYS} días hábiles. Guarda esta constancia.
              </p>
            </div>
          </div>
          <ComplaintSheet c={done} title={sf.complaints.title} />
          <div className="row g3 wrap-row no-print">
            <button className="btn" type="button" onClick={() => window.print()}><IconPrint size="sm" /> Imprimir o guardar en PDF</button>
            <Link className="btn ghost" href="/">Volver a la tienda</Link>
          </div>
        </div>
      </div>
    );
  }

  const cls = (k: string) => `field ${errors[k] ? "error" : ""}`;
  const err = (k: string) => (errors[k] ? <p className="err-msg" id={`lr-${k}-err`}>{errors[k]}</p> : null);
  const inv = (k: string) => (errors[k] ? { "aria-invalid": true, "aria-describedby": `lr-${k}-err` } : {});

  return (
    <div className="wrap" style={{ paddingBlock: "48px 96px" }}>
      <div className="stack g5" style={{ maxWidth: 760, margin: "0 auto" }}>
        <header className="stack g3">
          <p className="eyebrow">{tenant.name}</p>
          <h1 className="h1"><Rich text={sf.complaints.title} /></h1>
          <p className="lead">{sf.complaints.lead}</p>
        </header>

        <div className="hoja-prov small">
          <div><span className="muted">Razón social</span><b>{b.legalName}</b></div>
          <div><span className="muted">RUC</span><b>{b.ruc}</b></div>
          <div><span className="muted">Dirección</span><b>{b.address}</b></div>
        </div>

        <form className="lr-form stack g6" onSubmit={submit} noValidate>
          <fieldset className="stack g4" style={fieldset}>
            <legend className="h4" style={{ marginBottom: 14 }}>1. Tus datos</legend>
            <div className={cls("name")}><label htmlFor="lr-name">Nombre completo</label><input id="lr-name" className="input" autoComplete="name" value={f.consumer.name} onChange={(e) => setC({ name: e.target.value })} {...inv("name")} />{err("name")}</div>
            <div className="grid2">
              <div className="field"><label htmlFor="lr-doctype">Tipo de documento</label>
                <select id="lr-doctype" className="select" value={f.consumer.docType} onChange={(e) => setC({ docType: e.target.value as ComplaintInput["consumer"]["docType"] })}>
                  <option value="DNI">DNI</option><option value="CE">Carné de extranjería</option><option value="Pasaporte">Pasaporte</option>
                </select>
              </div>
              <div className={cls("doc")}><label htmlFor="lr-doc">N.º de documento</label><input id="lr-doc" className="input" inputMode={f.consumer.docType === "DNI" ? "numeric" : "text"} value={f.consumer.docNumber} onChange={(e) => setC({ docNumber: e.target.value })} {...inv("doc")} />{err("doc")}</div>
            </div>
            <div className={cls("address")}><label htmlFor="lr-address">Domicilio</label><input id="lr-address" className="input" autoComplete="street-address" placeholder="Dirección, distrito y ciudad" value={f.consumer.address} onChange={(e) => setC({ address: e.target.value })} {...inv("address")} />{err("address")}</div>
            <div className="grid2">
              <div className="field"><label htmlFor="lr-phone">Celular <span className="muted" style={{ fontWeight: 500 }}>(opcional)</span></label><input id="lr-phone" className="input" type="tel" autoComplete="tel" inputMode="tel" value={f.consumer.phone} onChange={(e) => setC({ phone: e.target.value })} /></div>
              <div className={cls("email")}><label htmlFor="lr-email">Correo</label><input id="lr-email" className="input" type="email" autoComplete="email" value={f.consumer.email} onChange={(e) => setC({ email: e.target.value })} {...inv("email")} />{err("email")}</div>
            </div>
            <label className="row g3 tap">
              <input type="checkbox" checked={minor} onChange={(e) => setMinor(e.target.checked)} />
              <span>Soy menor de edad</span>
            </label>
            {minor && <div className={cls("guardian")}><label htmlFor="lr-guardian">Nombre del padre, madre o apoderado</label><input id="lr-guardian" className="input" value={f.consumer.guardian} onChange={(e) => setC({ guardian: e.target.value })} {...inv("guardian")} />{err("guardian")}</div>}
          </fieldset>

          <hr className="hr" />
          <fieldset className="stack g4" style={fieldset}>
            <legend className="h4" style={{ marginBottom: 14 }}>2. ¿Sobre qué es?</legend>
            <div className="seg-sizes" role="radiogroup" aria-label="Tipo de bien contratado">
              {(["producto", "servicio"] as const).map((t) => (
                <button key={t} type="button" role="radio" aria-checked={f.item.type === t} className={`seg-opt ${f.item.type === t ? "on" : ""}`} onClick={() => setI({ type: t })}>
                  <span className="t">{t === "producto" ? "Producto" : "Servicio"}</span>
                </button>
              ))}
            </div>
            <div className="grid2">
              <div className="field"><label htmlFor="lr-order">N.º de pedido <span className="muted" style={{ fontWeight: 500 }}>(si lo tienes)</span></label><input id="lr-order" className="input" placeholder="Ej.: 0042" value={f.item.orderNumber} onChange={(e) => setI({ orderNumber: e.target.value })} /></div>
              <div className={cls("amount")}><label htmlFor="lr-amount">Monto reclamado (S/) <span className="muted" style={{ fontWeight: 500 }}>(opcional)</span></label><input id="lr-amount" className="input" inputMode="decimal" placeholder="0.00" value={f.item.amount} onChange={(e) => setI({ amount: e.target.value })} {...inv("amount")} />{err("amount")}</div>
            </div>
            <div className={cls("description")}><label htmlFor="lr-description">Descripción del producto o servicio</label><input id="lr-description" className="input" value={f.item.description} onChange={(e) => setI({ description: e.target.value })} {...inv("description")} />{err("description")}</div>
          </fieldset>

          <hr className="hr" />
          <fieldset className="stack g4" style={fieldset}>
            <legend className="h4" style={{ marginBottom: 14 }}>3. Detalle</legend>
            <div className="seg-sizes" role="radiogroup" aria-label="Tipo de reclamación">
              {(["reclamo", "queja"] as const).map((k) => (
                <button key={k} type="button" role="radio" aria-checked={f.kind === k} className={`seg-opt ${f.kind === k ? "on" : ""}`} onClick={() => setF((x) => ({ ...x, kind: k }))}>
                  <span className="t">{k === "reclamo" ? "Reclamo" : "Queja"}</span>
                  <span className="p">{COMPLAINT_DEFS[k]}</span>
                </button>
              ))}
            </div>
            <div className={cls("detail")}><label htmlFor="lr-detail">¿Qué pasó?</label><textarea id="lr-detail" className="textarea" rows={5} maxLength={3000} value={f.detail} onChange={(e) => setF((x) => ({ ...x, detail: e.target.value }))} {...inv("detail")} />{err("detail")}</div>
            <div className={cls("request")}><label htmlFor="lr-request">¿Qué solución pides?</label><textarea id="lr-request" className="textarea" rows={3} maxLength={2000} value={f.request} onChange={(e) => setF((x) => ({ ...x, request: e.target.value }))} {...inv("request")} />{err("request")}</div>
          </fieldset>

          <div className={cls("agree")}>
            <label className="row g3 tap" style={{ alignItems: "flex-start" }}>
              <input id="lr-agree" type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} style={{ marginTop: 3 }} {...inv("agree")} />
              <span className="small">Declaro que los datos son verdaderos y acepto que se usen para atender esta hoja, según la <Link className="link" href={LEGAL_ROUTES.privacy}>política de privacidad</Link>.</span>
            </label>
            {err("agree")}
          </div>

          <div className="small muted stack g2">
            {COMPLAINT_NOTES.map((n) => <p key={n} style={{ margin: 0 }}>{n}</p>)}
          </div>

          {sendError && <div className="alert" role="alert"><IconAlert /><span className="small">{sendError}</span></div>}
          <button className="btn block" type="submit" disabled={sending}>{sending ? "Enviando…" : "Enviar hoja de reclamación"}</button>
        </form>
      </div>
    </div>
  );
}
