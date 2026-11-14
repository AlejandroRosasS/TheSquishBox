"use client";

import Link from "next/link";
import { useState } from "react";
import { track } from "@/lib/analytics";
import { useStore } from "@/components/StoreContext";
import { Rich } from "@/components/Rich";
import { fill } from "@/lib/format";
import { partyCode, placePartyRequest } from "@/lib/db/orders";
import { IconAlert, IconCheck } from "@/components/Icons";

const digits = (s: string) => s.replace(/\D/g, "");

type Sent = { id: string; name: string; phone: string; reason: string };

/**
 * Formulario de la página Contacto: motivo, mensaje y datos del cliente.
 * El mensaje entra a Admin › Pedidos (etiqueta «Contacto») y dispara las mismas alertas que un pedido especial.
 */
export function ContactForm() {
  const { tenant, storefront: sf, source } = useStore();
  const cf = sf.contactForm;
  const [reason, setReason] = useState(cf.reasons[0] ?? "");
  const [message, setMessage] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [sent, setSent] = useState<Sent | null>(null);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const er: Record<string, string> = {};
    if (message.trim().length < 3) er.msg = "Escribe tu mensaje.";
    if (name.trim().length < 3) er.name = "Escribe tu nombre.";
    if (digits(phone).length !== 9) er.phone = "Escribe un celular de 9 dígitos.";
    if (email && !/^\S+@\S+\.\S+$/.test(email)) er.email = "Revisa tu correo.";
    setErrors(er);
    if (Object.keys(er).length) {
      document.getElementById(`c-${Object.keys(er)[0]}`)?.focus();
      return;
    }
    const party = { kind: "contact" as const, reason, idea: message.trim(), refs: [] };
    let code: string;
    if (source === "db") {
      setSending(true);
      setSendError(false);
      try {
        const n = await placePartyRequest(tenant.slug, {
          customer: { name: name.trim(), phone: phone.trim(), email: email.trim() },
          delivery: {},
          party,
        });
        code = partyCode(n, party);
      } catch {
        setSendError(true);
        setSending(false);
        return;
      }
      setSending(false);
    } else {
      const n = Number(localStorage.getItem(`contact:${tenant.slug}`) || "0") + 1;
      localStorage.setItem(`contact:${tenant.slug}`, String(n));
      code = partyCode(n, party);
    }
    // Google Analytics: un contacto enviado cuenta como «lead» (sin datos personales, solo el motivo).
    track("generate_lead", { lead_source: "contacto", reason: reason || undefined });
    setSent({ id: code, name: name.trim().split(" ")[0], phone: phone.trim(), reason });
    document.getElementById("c-form-title")?.scrollIntoView?.({ behavior: "smooth", block: "center" });
  };

  const card = { background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 26, padding: "clamp(20px, 4vw, 32px)" } as const;

  if (sent) {
    return (
      <div className="stack g4" style={{ ...card, alignItems: "center", textAlign: "center" }} role="status">
        <span style={{ width: 64, height: 64, borderRadius: "50%", background: "var(--primary)", color: "var(--on-primary)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <IconCheck style={{ width: 28, height: 28 }} />
        </span>
        <p className="eyebrow">Mensaje N.º {sent.id}{sent.reason ? ` · ${sent.reason}` : ""}</p>
        <h2 className="h2"><Rich text={cf.sentTitle} /></h2>
        <p className="lead">{fill(cf.sentLead, { name: sent.name, phone: sent.phone })}</p>
        <div className="row g3 wrap-row" style={{ justifyContent: "center" }}>
          <Link className="btn" href="/tienda">Ver la tienda</Link>
          <button className="btn ghost" type="button" onClick={() => { setSent(null); setMessage(""); }}>Enviar otro mensaje</button>
        </div>
      </div>
    );
  }

  const fieldCls = (k: string) => `field ${errors[k] ? "error" : ""}`;
  const err = (k: string) => (errors[k] ? <p className="err-msg">{errors[k]}</p> : null);

  return (
        <form className="stack g6" style={card} onSubmit={submit} noValidate aria-labelledby="c-form-title">
          <h2 className="h3" id="c-form-title">{cf.formTitle}</h2>
          {cf.reasons.length > 0 && (
            <div className="field"><label htmlFor="c-reason">{cf.reasonLabel}</label>
              <select id="c-reason" className="select" value={reason} onChange={(e) => setReason(e.target.value)}>
                {cf.reasons.map((o) => <option key={o}>{o}</option>)}
              </select>
            </div>
          )}
          <div className={fieldCls("msg")}><label htmlFor="c-msg">{cf.messageLabel}</label><textarea id="c-msg" className="textarea" placeholder={cf.messagePlaceholder} value={message} onChange={(e) => setMessage(e.target.value)} aria-invalid={!!errors.msg || undefined} />{err("msg")}</div>

          <div className="stack g4">
            <div className={fieldCls("name")}><label htmlFor="c-name">Nombre</label><input id="c-name" className="input" autoComplete="name" placeholder="Nombre y apellido" value={name} onChange={(e) => setName(e.target.value)} aria-invalid={!!errors.name || undefined} />{err("name")}</div>
            <div className="grid2">
              <div className={fieldCls("phone")}><label htmlFor="c-phone">Celular (WhatsApp)</label><input id="c-phone" className="input" type="tel" inputMode="numeric" autoComplete="tel" placeholder="9XX XXX XXX" value={phone} onChange={(e) => setPhone(e.target.value)} aria-invalid={!!errors.phone || undefined} />{err("phone")}</div>
              <div className={fieldCls("email")}><label htmlFor="c-email">Correo <span className="muted" style={{ fontWeight: 500 }}>(opcional)</span></label><input id="c-email" className="input" type="email" autoComplete="email" placeholder="tucorreo@ejemplo.com" value={email} onChange={(e) => setEmail(e.target.value)} aria-invalid={!!errors.email || undefined} />{err("email")}</div>
            </div>
          </div>
          {sendError && <div className="alert" role="alert"><IconAlert /><span className="small">No pudimos enviar tu mensaje. Revisa tu conexión e inténtalo otra vez.</span></div>}
          <button className="btn block" type="submit" disabled={sending}>{sending ? "Enviando…" : cf.submitLabel}</button>
          {cf.footnote && <p className="small muted" style={{ textAlign: "center" }}><Rich text={cf.footnote} /></p>}
        </form>
  );
}
