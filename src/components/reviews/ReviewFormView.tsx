"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useStore } from "@/components/StoreContext";
import { Rich } from "@/components/Rich";
import { Photo } from "@/components/Photo";
import { SLOTS } from "@/lib/media";
import { loadReviewRequest, submitReview, type ReviewRequestInfo } from "@/lib/db/reviews";

const PATH = "M12 2.8l2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17.2l-5.7 3.1 1.2-6.4-4.7-4.4 6.4-.8z";
const WORDS = ["", "Malo", "Regular", "Bueno", "Muy bueno", "Excelente"];

/** Selector de 1 a 5 estrellas con radios reales (teclado y lectores de pantalla). */
function StarPicker({ name, label, value, onChange }: { name: string; label: string; value: number; onChange: (v: number) => void }) {
  return (
    <fieldset className="stack g1" style={{ border: 0, padding: 0, margin: 0 }}>
      <legend className="visually-hidden">{label}</legend>
      <div className="row g3 wrap-row" style={{ alignItems: "center" }}>
        <div className="rv-stars">
          {[1, 2, 3, 4, 5].map((n) => (
            <label key={n} className={n <= value ? "on" : ""}>
              <input type="radio" name={name} value={n} checked={value === n} onChange={() => onChange(n)} aria-label={`${n} de 5 estrellas · ${WORDS[n]}`} />
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d={PATH} /></svg>
            </label>
          ))}
        </div>
        <span className="small muted" aria-hidden="true">{WORDS[value]}</span>
      </div>
    </fieldset>
  );
}

type State = { phase: "loading" } | { phase: "invalid" } | { phase: "ready"; info: ReviewRequestInfo } | { phase: "done" };

/** Página del link de reseña: el cliente califica cada producto de su compra. */
export function ReviewFormView({ token }: { token: string }) {
  const { tenant, catalog, storefront, source } = useStore();
  const sf = storefront.reviews;
  const [state, setState] = useState<State>({ phase: "loading" });
  const [name, setName] = useState("");
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [bodies, setBodies] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    if (source !== "db") {
      const t = setTimeout(() => setState({ phase: "invalid" }), 0);
      return () => clearTimeout(t);
    }
    loadReviewRequest(token)
      .then((info) => {
        if (!alive) return;
        // Un link de otra marca no sirve en esta tienda.
        if (!info || info.expired || info.tenant !== tenant.slug) return setState({ phase: "invalid" });
        if (info.items.every((i) => i.done)) return setState({ phase: "done" });
        setState({ phase: "ready", info });
      })
      .catch(() => alive && setState({ phase: "invalid" }));
    return () => { alive = false; };
  }, [token, tenant.slug, source]);

  if (state.phase === "loading") return <div className="wrap" style={{ minHeight: "60vh" }} aria-busy="true" />;

  if (state.phase === "invalid" || state.phase === "done") {
    const done = state.phase === "done";
    return (
      <div className="wrap rv-form stack g4" role="status">
        <h1 className="h1"><Rich text={done ? sf.thanksTitle : sf.invalidTitle} /></h1>
        <p className="lead">{done ? sf.thanksText : sf.invalidText}</p>
        <div><Link className="btn" href="/tienda">Ver la tienda</Link></div>
      </div>
    );
  }

  const items = state.info.items.filter((i) => !i.done);
  const product = (dbId: string) => catalog.products.find((p) => p.dbId === dbId);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const rated = items.filter((i) => ratings[i.productId]);
    if (!name.trim()) return setError("Escribe tu nombre.");
    if (!rated.length) return setError(items.length > 1 ? "Califica al menos un producto con estrellas." : "Elige de 1 a 5 estrellas.");
    setError("");
    setBusy(true);
    try {
      await submitReview(token, {
        name: name.trim(),
        reviews: rated.map((i) => ({ productId: i.productId, rating: ratings[i.productId], body: (bodies[i.productId] ?? "").trim() })),
      });
      setState({ phase: "done" });
      window.scrollTo({ top: 0 });
    } catch {
      setError("No pudimos guardar tu reseña. Revisa tu conexión e inténtalo otra vez.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="wrap rv-form stack g6" onSubmit={submit} noValidate>
      <div className="stack g3">
        <p className="eyebrow">{tenant.name}</p>
        <h1 className="h1"><Rich text={sf.formTitle} /></h1>
        <p className="lead">{state.info.customer ? `${state.info.customer}, ` : ""}{sf.formLead.charAt(0).toLowerCase() + sf.formLead.slice(1)}</p>
      </div>

      <div className="stack g4">
        {items.map((i) => {
          const p = product(i.productId);
          return (
            <div className="rv-item" key={i.productId}>
              <div className="ph r11">{p?.images[0] && <Photo src={p.images[0]} alt="" slot={SLOTS.product} loading="lazy" />}</div>
              <div className="stack g3">
                <p className="h4" style={{ margin: 0 }}>{i.name}</p>
                <StarPicker name={`r-${i.productId}`} label={`Calificación de ${i.name}`} value={ratings[i.productId] ?? 0} onChange={(v) => setRatings((r) => ({ ...r, [i.productId]: v }))} />
                <div className="field">
                  <label htmlFor={`b-${i.productId}`}>Comentario <span className="muted" style={{ fontWeight: 500 }}>(opcional)</span></label>
                  <textarea id={`b-${i.productId}`} className="textarea" maxLength={1500} placeholder={sf.commentPlaceholder} value={bodies[i.productId] ?? ""} onChange={(e) => setBodies((b) => ({ ...b, [i.productId]: e.target.value }))} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="field">
        <label htmlFor="rv-name">Tu nombre</label>
        <input id="rv-name" className="input" autoComplete="name" maxLength={60} value={name} onChange={(e) => setName(e.target.value)} aria-describedby="rv-name-h" />
        <span className="hint" id="rv-name-h">{sf.nameHelp}</span>
      </div>

      {error && <p className="err-msg" role="alert">{error}</p>}
      <button className="btn block" type="submit" disabled={busy}>{busy ? "Enviando…" : sf.submit}</button>
    </form>
  );
}
