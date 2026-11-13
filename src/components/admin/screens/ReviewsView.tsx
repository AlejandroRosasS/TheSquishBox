"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAdmin, useAdminCatalog } from "../AdminContext";
import { useDb } from "../DbContext";
import { AdminPage, DemoNote } from "../AdminPage";
import { AICheck, AICopy, AIEye, AIWhatsApp } from "../AdminIcons";
import { waTo } from "./OrderView";
import { refreshStore } from "@/app/admin/actions";
import { orderCode } from "@/lib/db/orders";
import { ADMIN_REVIEW_COLUMNS, createManualRequest, type AdminReviewRow } from "@/lib/db/reviews";
import { fillTemplate, reviewDate, reviewPath, type ReviewStatus } from "@/lib/reviews";

const TABS: { id: ReviewStatus; label: string }[] = [
  { id: "pending", label: "Por revisar" },
  { id: "approved", label: "Publicadas" },
  { id: "hidden", label: "Ocultas" },
];

/** ★★★★☆ en texto: el panel no usa la paleta de la marca. */
const starText = (n: number) => "★★★★★".slice(0, n) + "☆☆☆☆☆".slice(0, 5 - n);

function useReviews() {
  const db = useDb();
  const { toast } = useAdmin();
  const tenantId = db?.state.phase === "ready" ? db.state.tenantId : null;
  const [list, setList] = useState<AdminReviewRow[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "missing" | "demo">(db ? "loading" : "demo");

  const load = useCallback(async () => {
    if (!db || !tenantId) return;
    const { data, error } = await db.client.from("reviews").select(ADMIN_REVIEW_COLUMNS).eq("tenant_id", tenantId).order("created_at", { ascending: false }).limit(500);
    if (error) return setState("missing");
    setList((data ?? []) as unknown as AdminReviewRow[]);
    setState("ready");
  }, [db, tenantId]);

  useEffect(() => {
    const t = setTimeout(() => void load(), 0);
    return () => clearTimeout(t);
  }, [load]);

  const save = useCallback(
    async (r: AdminReviewRow, patch: Partial<Pick<AdminReviewRow, "status" | "reply">>, done: string) => {
      if (!db) return false;
      const user = db.state.phase === "ready" ? db.state.user?.id : undefined;
      const now = new Date().toISOString();
      const row: Record<string, unknown> = { ...patch };
      if (patch.status) Object.assign(row, { moderated_at: now, moderated_by: user ?? null });
      if (patch.reply !== undefined) row.replied_at = patch.reply ? now : null;
      const { error } = await db.client.from("reviews").update(row).eq("id", r.id);
      if (error) {
        toast(`No se pudo guardar: ${error.message}`);
        return false;
      }
      setList((l) => l.map((x) => (x.id === r.id ? { ...x, ...patch, moderated_at: patch.status ? now : x.moderated_at } : x)));
      // La tienda guarda las reseñas en caché: se refresca para que el cambio se vea ya.
      if (patch.status || r.status === "approved") void refreshStore();
      toast(done);
      return true;
    },
    [db, toast],
  );

  return { list, state, save, tenantId, client: db?.client ?? null };
}

function ReviewItem({ r, onSave }: { r: AdminReviewRow; onSave: (patch: Partial<Pick<AdminReviewRow, "status" | "reply">>, done: string) => Promise<boolean> }) {
  const [reply, setReply] = useState(r.reply ?? "");
  const [open, setOpen] = useState(false);
  const customer = r.review_requests?.customer?.name;
  const orderId = r.review_requests?.order_id;
  const dirty = reply.trim() !== (r.reply ?? "");
  return (
    <article className="a-card stack g3" aria-label={`Reseña de ${r.author_name}`}>
      <div className="row between g3 wrap-row" style={{ alignItems: "flex-start" }}>
        <div className="stack g1">
          <span style={{ fontSize: 18, letterSpacing: 2, color: "var(--a-text)" }} role="img" aria-label={`${r.rating} de 5 estrellas`}>{starText(r.rating)}</span>
          <b>{r.products?.name ?? "Producto eliminado"}</b>
        </div>
        <span className="a-cap">{reviewDate(r.created_at)}</span>
      </div>
      {r.body ? <p style={{ margin: 0, whiteSpace: "pre-line" }}>{r.body}</p> : <p className="a-cap" style={{ margin: 0 }}>Solo dejó estrellas, sin comentario.</p>}
      <p className="a-cap" style={{ margin: 0 }}>
        Firmado como <b>{r.author_name}</b>
        {customer && customer !== r.author_name ? ` · cliente: ${customer}` : ""}
        {" · "}
        {r.verified ? "Compra web" : "Link enviado a mano"}
        {orderId ? " · " : ""}
        {orderId && <PedidoLink orderId={orderId} />}
      </p>

      {r.status === "approved" && (open || r.reply) ? (
        <div className="a-field">
          <label htmlFor={`rp-${r.id}`}>Respuesta pública de la tienda</label>
          <textarea id={`rp-${r.id}`} className="a-textarea" maxLength={1500} value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Ej.: ¡Gracias, Ana! Nos alegra que le haya encantado." />
          <div className="row g2 wrap-row">
            <button className="a-btn sm primary" type="button" disabled={!dirty} onClick={() => void onSave({ reply: reply.trim() || null }, reply.trim() ? "Respuesta publicada" : "Respuesta quitada")}>Guardar respuesta</button>
            {!r.reply && <button className="a-btn sm ghost" type="button" onClick={() => { setOpen(false); setReply(""); }}>Cancelar</button>}
          </div>
        </div>
      ) : null}

      <div className="row g2 wrap-row">
        {r.status !== "approved" && (
          <button className="a-btn sm primary" type="button" onClick={() => void onSave({ status: "approved" }, "Reseña publicada en la tienda")}><AICheck size="sm" />Publicar</button>
        )}
        {r.status !== "hidden" && (
          <button className="a-btn sm" type="button" onClick={() => void onSave({ status: "hidden" }, "Reseña oculta")}>Ocultar</button>
        )}
        {r.status === "approved" && !r.reply && !open && (
          <button className="a-btn sm ghost" type="button" onClick={() => setOpen(true)}>Responder</button>
        )}
        {r.status === "approved" && r.products?.slug && (
          <a className="a-btn sm ghost" href={`/p/${r.products.slug}#resenas`} target="_blank" rel="noreferrer"><AIEye size="sm" />Ver en la tienda</a>
        )}
      </div>
    </article>
  );
}

/** Link al pedido en el panel (el número sale de la base). */
function PedidoLink({ orderId }: { orderId: string }) {
  const db = useDb();
  const [n, setN] = useState<number | null>(null);
  useEffect(() => {
    if (!db) return;
    let alive = true;
    void db.client.from("orders").select("number").eq("id", orderId).maybeSingle().then(({ data }) => { if (alive && data) setN(data.number as number); });
    return () => { alive = false; };
  }, [db, orderId]);
  if (n === null) return null;
  return <Link href={`/admin/pedidos/${orderCode(n)}`}>pedido #{orderCode(n)}</Link>;
}

/** Link de reseña para un cliente que no compró por la web (feria, Instagram, WhatsApp). */
function ManualRequest({ client, tenantId }: { client: NonNullable<ReturnType<typeof useReviews>["client"]>; tenantId: string }) {
  const { bundle, toast } = useAdmin();
  const { catalog } = useAdminCatalog();
  const sf = bundle.storefront.reviews;
  const products = catalog.products.filter((p) => p.status !== "draft");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [link, setLink] = useState<string | null>(null);
  const [err, setErr] = useState("");
  const linkRef = useRef<HTMLInputElement>(null);

  const create = async () => {
    if (!name.trim()) return setErr("Escribe el nombre del cliente.");
    if (!picked.length) return setErr("Elige al menos un producto que compró.");
    setErr("");
    setBusy(true);
    try {
      const r = await createManualRequest(client, tenantId, { customer: { name: name.trim(), phone: phone.trim() }, productSlugs: picked });
      setLink(`${window.location.origin}${reviewPath(r.token)}`);
      setTimeout(() => linkRef.current?.select(), 0);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "No se pudo crear el link.");
    } finally {
      setBusy(false);
    }
  };

  const reset = () => { setLink(null); setName(""); setPhone(""); setPicked([]); };
  const message = link ? fillTemplate(sf.whatsappMessage, { nombre: name.trim().split(/\s+/)[0], marca: bundle.tenant.name, link }) : "";
  const wa = link && phone.replace(/\D/g, "").length >= 9 ? waTo(phone, message) : link ? `https://wa.me/?text=${encodeURIComponent(message)}` : null;

  return (
    <section className="a-card stack g4" aria-labelledby="rv-manual">
      <div className="stack g1">
        <h2 className="a-h2" id="rv-manual">Pedir reseña a un cliente</h2>
        <p className="a-cap">Para quien te compró en feria, por Instagram o WhatsApp. A los pedidos de la web se les pide desde cada pedido entregado.</p>
      </div>
      {link ? (
        <>
          <div className="a-field">
            <label htmlFor="rv-link">Link para {name.trim().split(/\s+/)[0]}</label>
            <input ref={linkRef} id="rv-link" className="a-input" readOnly value={link} onFocus={(e) => e.target.select()} />
          </div>
          <div className="row g2 wrap-row">
            {wa && <a className="a-btn wa" href={wa} target="_blank" rel="noreferrer"><AIWhatsApp />Enviar por WhatsApp</a>}
            <button className="a-btn" type="button" onClick={() => { void navigator.clipboard?.writeText(link); toast("Link copiado"); }}><AICopy size="sm" />Copiar link</button>
            <button className="a-btn ghost" type="button" onClick={reset}>Otro cliente</button>
          </div>
          <p className="a-cap">El link sirve 90 días y una sola vez por producto.</p>
        </>
      ) : (
        <>
          <div className="a-grid2">
            <div className="a-field"><label htmlFor="rv-name">Nombre del cliente</label><input id="rv-name" className="a-input" value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" /></div>
            <div className="a-field"><label htmlFor="rv-phone">Celular <span className="a-cap">(opcional)</span></label><input id="rv-phone" className="a-input" type="tel" inputMode="numeric" placeholder="9XX XXX XXX" value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
          </div>
          <fieldset className="stack g2" style={{ border: 0, padding: 0, margin: 0 }}>
            <legend className="a-label" style={{ marginBottom: 6 }}>¿Qué compró?</legend>
            <div className="stack g1" style={{ maxHeight: 260, overflow: "auto" }}>
              {products.map((p) => (
                <label key={p.id} className="row g3" style={{ minHeight: 44, cursor: "pointer" }}>
                  <input type="checkbox" style={{ width: 20, height: 20 }} checked={picked.includes(p.id)} onChange={() => setPicked((l) => (l.includes(p.id) ? l.filter((x) => x !== p.id) : [...l, p.id]))} />
                  <span>{p.name}</span>
                </label>
              ))}
            </div>
          </fieldset>
          {err && <p className="a-banner err" role="alert" style={{ margin: 0 }}>{err}</p>}
          <button className="a-btn primary" type="button" style={{ alignSelf: "flex-start" }} disabled={busy} onClick={() => void create()}>{busy ? "Creando…" : "Crear link de reseña"}</button>
        </>
      )}
    </section>
  );
}

export function ReviewsView() {
  const { list, state, save, tenantId, client } = useReviews();
  const [tab, setTab] = useState<ReviewStatus>("pending");
  const counts = useMemo(() => Object.fromEntries(TABS.map((t) => [t.id, list.filter((r) => r.status === t.id).length])) as Record<ReviewStatus, number>, [list]);
  const shown = list.filter((r) => r.status === tab);
  const avg = counts.approved ? list.filter((r) => r.status === "approved").reduce((s, r) => s + r.rating, 0) / counts.approved : 0;

  return (
    <AdminPage title="Reseñas">
      <div className="a-head">
        <div className="stack g1">
          <h1 className="a-h1">Reseñas</h1>
          <p className="a-sub">Lo que opinan tus clientes de cada producto. Solo se publican las que apruebas, y solo esas ve Google.</p>
        </div>
        {counts.approved > 0 && <span className="a-cap">{counts.approved} publicadas · promedio {avg.toFixed(1)} de 5</span>}
      </div>

      {state === "missing" && <p className="a-banner err">Las reseñas aún no están activadas en la base de datos (falta aplicar la migración 0017).</p>}

      <div className="a-cols">
        <div className="stack g4">
          <div className="a-seg a-tabs" role="tablist" aria-label="Estado de las reseñas">
            {TABS.map((t) => (
              <button key={t.id} id={`rv-tab-${t.id}`} type="button" role="tab" className={tab === t.id ? "on" : ""} aria-selected={tab === t.id} aria-controls="rv-panel" onClick={() => setTab(t.id)}>
                {t.label}{counts[t.id] ? ` (${counts[t.id]})` : ""}
              </button>
            ))}
          </div>
          <div id="rv-panel" role="tabpanel" aria-labelledby={`rv-tab-${tab}`} className="stack g4">
            {state === "loading" && <p className="a-cap">Cargando…</p>}
            {state === "ready" && !shown.length && (
              <p className="a-cap">
                {tab === "pending" ? "No hay reseñas por revisar." : tab === "approved" ? "Todavía no publicas reseñas." : "No hay reseñas ocultas."}
              </p>
            )}
            {shown.map((r) => <ReviewItem key={`${r.id}-${r.status}`} r={r} onSave={(patch, done) => save(r, patch, done)} />)}
          </div>
        </div>

        <div className="stack g5">
          {client && tenantId && <ManualRequest client={client} tenantId={tenantId} />}
          <section className="a-card stack g2" aria-labelledby="rv-rules">
            <h2 className="a-h2" id="rv-rules">Buenas prácticas</h2>
            <ul className="a-cap stack g2" style={{ margin: 0, paddingLeft: 18 }}>
              <li>Publica también las reseñas regulares o malas: ocultar solo las malas va contra las reglas de Google y puede quitarte las estrellas.</li>
              <li>Oculta solo spam, insultos, datos personales o reseñas que no son del producto.</li>
              <li>Responder con amabilidad a una reseña mala da más confianza que esconderla.</li>
              <li>No regales descuentos a cambio de reseñas ni escribas reseñas tú mismo.</li>
            </ul>
          </section>
          {state === "demo" && <DemoNote>Las reseñas necesitan la base de datos: en la demo no hay reseñas.</DemoNote>}
        </div>
      </div>
    </AdminPage>
  );
}

