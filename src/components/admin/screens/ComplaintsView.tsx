"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useAdmin } from "../AdminContext";
import { useDb } from "../DbContext";
import { AdminPage, DemoNote } from "../AdminPage";
import { AIMail } from "../AdminIcons";
import { COMPLAINT_COLUMNS, toComplaint, type ComplaintRow } from "@/lib/db/complaints";
import {
  addBusinessDays, businessOf, complaintDate, complaintSections, fmtDate, isPlaceholder, loadDemoComplaints, RESPONSE_BUSINESS_DAYS, saveDemoComplaints,
  type Complaint,
} from "@/lib/legal";

/** Hojas del libro de reclamaciones: de la base (equipo de la marca) o, en la demo, de este navegador. */
function useComplaints() {
  const db = useDb();
  const { bundle, toast } = useAdmin();
  const slug = bundle.tenant.slug;
  const tenantId = db?.state.phase === "ready" ? db.state.tenantId : null;
  const [list, setList] = useState<Complaint[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "missing">("loading");

  const load = useCallback(async () => {
    if (!db) {
      setList(loadDemoComplaints(slug));
      setState("ready");
      return;
    }
    if (!tenantId) return;
    const { data, error } = await db.client.from("complaints").select(COMPLAINT_COLUMNS).eq("tenant_id", tenantId).order("created_at", { ascending: false }).limit(500);
    if (error) {
      // La tabla llega con la migración 0006; mientras no esté aplicada, se avisa en pantalla.
      setState("missing");
      return;
    }
    setList(((data ?? []) as ComplaintRow[]).map(toComplaint));
    setState("ready");
  }, [db, tenantId, slug]);

  useEffect(() => {
    const t = setTimeout(() => void load(), 0);
    return () => clearTimeout(t);
  }, [load]);

  const answer = useCallback(
    async (c: Complaint, response: string) => {
      const respondedAt = new Date().toISOString();
      if (db) {
        const { error } = await db.client.from("complaints").update({ status: "answered", response, responded_at: respondedAt }).eq("id", c.id);
        if (error) {
          toast(`No se pudo guardar: ${error.message}`);
          return false;
        }
      }
      const next = list.map((x) => (x.id === c.id ? { ...x, status: "answered" as const, response, respondedAt } : x));
      if (!db) saveDemoComplaints(slug, next);
      setList(next);
      return true;
    },
    [db, list, slug, toast],
  );

  return { list, state, answer };
}

function dueInfo(c: Complaint) {
  const due = addBusinessDays(new Date(c.createdAt), RESPONSE_BUSINESS_DAYS);
  const msLeft = due.getTime() - Date.now();
  const daysLeft = Math.ceil(msLeft / 86_400_000);
  return { due, daysLeft };
}

export function ComplaintsView() {
  const { bundle, toast } = useAdmin();
  const { tenant, storefront } = bundle;
  const { list, state, answer } = useComplaints();
  const [selId, setSelId] = useState<string | null>(null);
  const sel = list.find((c) => c.id === selId) ?? null;
  const [draft, setDraft] = useState("");
  const open = list.filter((c) => c.status === "open").length;
  const b = businessOf(tenant, storefront);
  const missingBiz = [b.legalName, b.ruc, b.address, b.email].some(isPlaceholder);

  const pick = (c: Complaint) => {
    setSelId(c.id);
    setDraft(c.response);
    setTimeout(() => document.getElementById("rc-detail")?.focus(), 0);
  };

  const mailto = (c: Complaint, text: string) => {
    const subject = `Respuesta a tu hoja de reclamación N.º ${c.code} · ${tenant.name}`;
    const body = `Hola, ${c.consumer.name}:\n\n${text}\n\n${b.legalName} · RUC ${b.ruc}\n${b.phone}`;
    return `mailto:${c.consumer.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  return (
    <AdminPage title="Reclamaciones" back={{ href: "/admin/ajustes", label: "Ajustes" }}>
      <div className="a-head">
        <div className="stack g1">
          <h1 className="a-h1">Libro de reclamaciones</h1>
          <p className="a-sub">
            Hojas que dejaron tus clientes en la tienda. Por ley debes responder en máximo {RESPONSE_BUSINESS_DAYS} días hábiles y conservarlas 2 años.
          </p>
        </div>
        <a className="a-btn" href="/libro-de-reclamaciones" target="_blank" rel="noreferrer">Ver en la tienda</a>
      </div>

      {missingBiz && (
        <p className="a-banner warn">
          <span>Faltan datos de la empresa (razón social, RUC, dirección o correo). Aparecen en cada hoja: complétalos en <Link href="/admin/textos">Textos › Empresa y contacto</Link> y publica.</span>
        </p>
      )}
      {state === "missing" && <p className="a-banner err">El libro aún no está activado en la base de datos (falta aplicar la migración 0006). Hasta entonces, la tienda no puede guardar hojas.</p>}

      <div className="a-cols even">
        <section className="a-card flush" aria-labelledby="rc-list">
          <div className="a-card-h">
            <h2 className="a-h2" id="rc-list">Hojas</h2>
            <span className="a-cap">{open ? `${open} por responder` : "Todo respondido"}</span>
          </div>
          {state === "loading" && <p className="a-cap" style={{ padding: 20 }}>Cargando…</p>}
          {state !== "loading" && !list.length && <p className="a-cap" style={{ padding: 20 }}>Todavía no hay hojas de reclamación.</p>}
          {list.map((c) => {
            const { daysLeft } = dueInfo(c);
            const late = c.status === "open" && daysLeft <= 3;
            return (
              <button key={c.id} type="button" className="a-tr" style={{ gridTemplateColumns: "1fr auto", width: "100%", textAlign: "left", background: c.id === selId ? "var(--a-sunken)" : "transparent", border: 0, borderBottom: "1px solid var(--a-border)", font: "inherit", cursor: "pointer" }} aria-pressed={c.id === selId} onClick={() => pick(c)}>
                <span className="stack">
                  <b>N.º {c.code} · {c.kind === "reclamo" ? "Reclamo" : "Queja"}</b>
                  <span className="a-cap">{c.consumer.name} · {fmtDate(c.createdAt)}</span>
                </span>
                {c.status === "answered" ? (
                  <span className="st pagado">Respondida</span>
                ) : (
                  <span className={`st ${late ? "error" : "pend"}`}>{daysLeft > 0 ? `Quedan ${daysLeft} d` : "Vencida"}</span>
                )}
              </button>
            );
          })}
        </section>

        <section className="a-card" aria-labelledby="rc-detail" >
          {!sel ? (
            <p className="a-cap">Elige una hoja para ver el detalle y responder.</p>
          ) : (
            <>
              <div className="stack g1">
                <h2 className="a-h2" id="rc-detail" tabIndex={-1}>Hoja N.º {sel.code}</h2>
                <p className="a-cap">
                  Recibida el {complaintDate(sel.createdAt)} · responder hasta el {fmtDate(dueInfo(sel).due.toISOString())} (aprox., sin contar feriados)
                </p>
              </div>
              {complaintSections(sel).slice(0, 4).map((s) => (
                <div key={s.title} className="stack g2">
                  <p className="a-label">{s.title}</p>
                  {s.rows.map(([k, v]) => (
                    <div key={k} className="row between g3" style={{ alignItems: "flex-start" }}>
                      <span className="a-cap" style={{ minWidth: 120 }}>{k}</span>
                      <span style={{ textAlign: "right", whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{v}</span>
                    </div>
                  ))}
                </div>
              ))}
              <div className="a-field">
                <label htmlFor="rc-resp">Respuesta y acciones adoptadas</label>
                <textarea id="rc-resp" className="a-textarea" rows={6} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Ej.: Lamentamos lo ocurrido. Te cambiamos el producto y coordinamos la entrega por WhatsApp." />
                <span className="a-cap">Envíala al correo del cliente ({sel.consumer.email}) y luego márcala como respondida.</span>
              </div>
              <div className="row g2 wrap-row">
                <a className={`a-btn ${draft.trim() ? "" : "disabled"}`} aria-disabled={!draft.trim()} href={draft.trim() ? mailto(sel, draft.trim()) : undefined}>
                  <AIMail size="sm" /> Abrir correo con la respuesta
                </a>
                <button className="a-btn primary" type="button" disabled={!draft.trim()} onClick={async () => { if (await answer(sel, draft.trim())) toast("Hoja marcada como respondida"); }}>
                  {sel.status === "answered" ? "Actualizar respuesta" : "Marcar como respondida"}
                </button>
              </div>
            </>
          )}
        </section>
      </div>
      <DemoNote untilDb>Demo: las hojas que envíes desde la tienda se guardan en este navegador. Con la base de datos quedan registradas con número correlativo.</DemoNote>
    </AdminPage>
  );
}
