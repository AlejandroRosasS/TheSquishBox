"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useStore } from "@/components/StoreContext";
import { Rich } from "@/components/Rich";
import { asset } from "@/lib/assets";
import { fill, formatPrice } from "@/lib/format";
import { formatDate } from "@/lib/orders";
import { useToday } from "@/lib/useToday";
import { IconCard, IconCheck, IconChat, IconClose, IconPen, IconUpload } from "@/components/Icons";

/* eslint-disable @next/next/no-img-element */

const STEP_ICONS = [IconPen, IconChat, IconCard];
const MAX_PHOTOS = 3;
const digits = (s: string) => s.replace(/\D/g, "");

type Sent = { id: string; name: string; phone: string; rows: [string, string][] };

export function PartyForm() {
  const { tenant, catalog, storefront: sf } = useStore();
  const party = sf.party;
  const product = catalog.products.find((p) => p.id === party.productId);
  const sizes = [
    ...(product?.variants.map((v) => ({ id: v.id, label: v.label, sub: `${formatPrice(v.price, tenant.currency)} c/u` })) ?? []),
    { id: "unsure", label: party.unsureLabel, sub: "Te recomendamos" },
  ];

  const [qty, setQty] = useState(party.defaultQuantity);
  const [size, setSize] = useState(sizes[0]?.id ?? "unsure");
  const [colors, setColors] = useState<string[]>([]);
  const [extras, setExtras] = useState(party.extrasOptions[0]);
  const [date, setDate] = useState("");
  const [district, setDistrict] = useState(party.districts[0]);
  const [comments, setComments] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [photos, setPhotos] = useState<{ url: string; name: string }[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [sent, setSent] = useState<Sent | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const today = useToday();

  useEffect(() => () => photos.forEach((p) => URL.revokeObjectURL(p.url)), [photos]);

  const addPhotos = (files: FileList | null) => {
    if (!files) return;
    const next = Array.from(files)
      .filter((f) => /image\/(jpe?g|png)/.test(f.type))
      .slice(0, MAX_PHOTOS - photos.length)
      .map((f) => ({ url: URL.createObjectURL(f), name: f.name }));
    setPhotos([...photos, ...next]);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const er: Record<string, string> = {};
    if (!date) er.date = "Elige la fecha del cumple.";
    if (name.trim().length < 3) er.name = "Escribe tu nombre.";
    if (digits(phone).length !== 9) er.phone = "Escribe un celular de 9 dígitos.";
    if (email && !/^\S+@\S+\.\S+$/.test(email)) er.email = "Revisa tu correo.";
    setErrors(er);
    if (Object.keys(er).length) {
      document.getElementById(`m-${Object.keys(er)[0]}`)?.focus();
      return;
    }
    const n = Number(localStorage.getItem(`party:${tenant.slug}`) || "0") + 1;
    localStorage.setItem(`party:${tenant.slug}`, String(n));
    const sizeLabel = sizes.find((s) => s.id === size)?.label ?? "";
    setSent({
      id: `F-${String(n).padStart(4, "0")}`,
      name: name.trim().split(" ")[0],
      phone: phone.trim(),
      rows: [
        ["Producto", product?.name ?? tenant.customOrder.label],
        ["Cantidad", /^\d+$/.test(qty) ? `${qty} mini box` : qty],
        ["Squishies por caja", sizeLabel],
        [party.extrasLabel.replace(/[¿?]/g, ""), extras],
        ...(colors.length ? [["Colores", colors.join(", ")] as [string, string]] : []),
        ["Fecha del cumple", formatDate(date)],
        ["Entrega", district],
        ...(photos.length ? [["Fotos", `${photos.length} adjunta${photos.length > 1 ? "s" : ""}`] as [string, string]] : []),
      ],
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (sent) {
    return (
      <div className="wrap" style={{ paddingBlock: "72px 112px" }}>
        <div className="stack g5" style={{ maxWidth: 640, margin: "0 auto", alignItems: "center", textAlign: "center" }} role="status">
          <span style={{ width: 72, height: 72, borderRadius: "50%", background: "var(--primary)", color: "var(--on-primary)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <IconCheck style={{ width: 32, height: 32 }} />
          </span>
          <p className="eyebrow">Pedido {tenant.customOrder.label.toLowerCase()} N.º {sent.id}</p>
          <h1 className="h1"><Rich text={party.sentTitle} /></h1>
          <p className="lead">{fill(party.sentLead, { name: sent.name, phone: sent.phone })}</p>
          <div className="stack g3" style={{ width: "100%", textAlign: "left", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 20, padding: 24 }}>
            <p className="label">Resumen</p>
            {sent.rows.map(([k, v]) => (
              <div className="sum-row" key={k}><span className="muted">{k}</span><span style={{ textAlign: "right" }}>{v}</span></div>
            ))}
          </div>
          <div className="row g3 wrap-row" style={{ justifyContent: "center" }}>
            <Link className="btn" href="/tienda">Ver la tienda</Link>
            <Link className="btn ghost" href="/">Volver al inicio</Link>
          </div>
        </div>
      </div>
    );
  }

  const fieldCls = (k: string) => `field ${errors[k] ? "error" : ""}`;
  const err = (k: string) => (errors[k] ? <p className="err-msg">{errors[k]}</p> : null);

  return (
    <div className="wrap" style={{ paddingBlock: "48px 96px" }}>
      <div className="split wide-right">
        <div className="stack g5">
          <p className="eyebrow">{party.eyebrow}</p>
          <h1 className="h1"><Rich text={party.title} /></h1>
          <p className="lead">{party.lead}</p>
          <div className="ph r45 only-d" style={{ borderRadius: 20 }}><img src={asset(tenant.slug, party.image)} alt={party.imageAlt} /></div>
          <ol className="steps" style={{ padding: 0, margin: 0, listStyle: "none" }}>
            {party.steps.map((s, i) => {
              const Icon = STEP_ICONS[i % STEP_ICONS.length];
              return (
                <li className="stp" key={s.title}>
                  <span className="b"><Icon size="sm" /></span>
                  <div><b>{s.title}</b><p className="small muted">{s.text}</p></div>
                </li>
              );
            })}
          </ol>
        </div>

        <form className="stack g6" style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 26, padding: "clamp(20px, 4vw, 32px)" }} onSubmit={submit} noValidate>
          <fieldset className="stack g3" style={{ border: 0, padding: 0, margin: 0 }}>
            <legend className="label" style={{ marginBottom: 10 }}>¿Cuántas mini box necesitas?</legend>
            <div className="row g2 wrap-row">
              {party.quantities.map((q) => (
                <button key={q} className={`chip ${qty === q ? "on" : ""}`} type="button" aria-pressed={qty === q} onClick={() => setQty(q)}>{q}</button>
              ))}
            </div>
          </fieldset>

          <fieldset className="stack g3" style={{ border: 0, padding: 0, margin: 0 }}>
            <legend className="label" style={{ marginBottom: 10 }}>{party.sizeQuestion}</legend>
            <div className="seg-sizes" role="radiogroup">
              {sizes.map((z) => (
                <button key={z.id} className={`seg-opt ${size === z.id ? "on" : ""}`} type="button" role="radio" aria-checked={size === z.id} onClick={() => setSize(z.id)}>
                  <span className="t">{z.label}</span>
                  <span className="p">{z.sub}</span>
                </button>
              ))}
            </div>
          </fieldset>

          {party.colors.length > 0 && (
            <fieldset className="stack g3" style={{ border: 0, padding: 0, margin: 0 }}>
              <legend className="label" style={{ marginBottom: 10 }}>Colores de la fiesta <span className="muted" style={{ fontWeight: 500 }}>(opcional)</span></legend>
              <div className="row g3 wrap-row">
                {party.colors.map((c) => {
                  const on = colors.includes(c.name);
                  return (
                    <button key={c.name} className={`row g2 chip ${on ? "on" : ""}`} type="button" aria-pressed={on} onClick={() => setColors(on ? colors.filter((x) => x !== c.name) : [...colors, c.name])}>
                      <span className="sw" style={{ width: 18, height: 18, background: c.hex }} />
                      {c.name}
                    </button>
                  );
                })}
              </div>
            </fieldset>
          )}

          <div className="grid2">
            <div className="field"><label htmlFor="m-extras">{party.extrasLabel}</label>
              <select id="m-extras" className="select" value={extras} onChange={(e) => setExtras(e.target.value)}>
                {party.extrasOptions.map((o) => <option key={o}>{o}</option>)}
              </select>
            </div>
            <div className={fieldCls("date")}><label htmlFor="m-date">Fecha del cumple</label><input id="m-date" className="input" type="date" min={today} value={date} onChange={(e) => setDate(e.target.value)} aria-invalid={!!errors.date || undefined} /><span className="hint">La confirmamos por WhatsApp.</span>{err("date")}</div>
          </div>
          <div className="field"><label htmlFor="m-dist">Distrito de entrega</label>
            <select id="m-dist" className="select" value={district} onChange={(e) => setDistrict(e.target.value)}>
              {party.districts.map((d) => <option key={d}>{d}</option>)}
            </select>
          </div>

          <div className="stack g3">
            <span className="label" id="m-photos-l">Foto de la temática <span className="muted" style={{ fontWeight: 500 }}>(opcional)</span></span>
            {photos.length < MAX_PHOTOS && (
              <label className="drop" aria-labelledby="m-photos-l">
                <IconUpload />
                <span className="small"><b style={{ color: "var(--text)" }}>Toca para subir</b> {party.uploadHint}</span>
                <span className="small">JPG o PNG · hasta {MAX_PHOTOS} fotos</span>
                <input ref={fileRef} type="file" accept="image/jpeg,image/png" multiple onChange={(e) => { addPhotos(e.target.files); e.target.value = ""; }} />
              </label>
            )}
            {photos.length > 0 && (
              <div className="thumbs">
                {photos.map((p, i) => (
                  <div className="thumb" key={p.url}>
                    <img src={p.url} alt={`Referencia ${i + 1}`} />
                    <button type="button" className="icon-btn" aria-label={`Quitar ${p.name}`} onClick={() => setPhotos(photos.filter((x) => x !== p))} style={{ position: "absolute", top: -10, right: -10, background: "var(--surface)", width: 32, height: 32 }}>
                      <IconClose size="xs" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="field"><label htmlFor="m-idea">Comentarios</label><textarea id="m-idea" className="textarea" placeholder={party.commentsPlaceholder} value={comments} onChange={(e) => setComments(e.target.value)} /></div>

          <hr className="hr" />
          <div className="stack g4">
            <p className="h4">Tus datos</p>
            <div className={fieldCls("name")}><label htmlFor="m-name">Nombre</label><input id="m-name" className="input" autoComplete="name" placeholder="Nombre y apellido" value={name} onChange={(e) => setName(e.target.value)} aria-invalid={!!errors.name || undefined} />{err("name")}</div>
            <div className="grid2">
              <div className={fieldCls("phone")}><label htmlFor="m-phone">Celular (WhatsApp)</label><input id="m-phone" className="input" type="tel" inputMode="numeric" placeholder="9XX XXX XXX" value={phone} onChange={(e) => setPhone(e.target.value)} aria-invalid={!!errors.phone || undefined} />{err("phone")}</div>
              <div className={fieldCls("email")}><label htmlFor="m-email">Correo <span className="muted" style={{ fontWeight: 500 }}>(opcional)</span></label><input id="m-email" className="input" type="email" placeholder="tucorreo@ejemplo.com" value={email} onChange={(e) => setEmail(e.target.value)} aria-invalid={!!errors.email || undefined} />{err("email")}</div>
            </div>
          </div>
          <button className="btn block" type="submit">Pedir cotización</button>
          <p className="small muted" style={{ textAlign: "center" }}>{party.footnote}</p>
        </form>
      </div>
    </div>
  );
}
