"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { money } from "@/lib/admin/format";
import { readSalesCsv, templateCsv, MANUAL_CHANNELS, type ReadResult } from "@/lib/sales/csv";
import { promptCampaigns, salesPrompt } from "@/lib/sales/prompt";
import { useAdmin, useAdminCatalog } from "../AdminContext";
import { useCampaigns } from "../AdminCampaigns";
import { AdminPage, BackLink } from "../AdminPage";
import { dayLabel, limaToday, useManualSales, usePricer } from "../AdminSales";
import { download } from "./SalesView";

const COLS = "90px minmax(0, 1.6fr) 110px 100px 120px";

export function ImportSalesView() {
  const { bundle, toast } = useAdmin();
  const { catalog } = useAdminCatalog();
  const { campaigns } = useCampaigns();
  const { sales, add, available } = useManualSales();
  const price = usePricer();
  const router = useRouter();
  const file = useRef<HTMLInputElement>(null);
  const [text, setText] = useState("");
  const [result, setResult] = useState<ReadResult | null>(null);
  const [saving, setSaving] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);

  const lite = { products: catalog.products.filter((p) => p.status !== "draft" && p.variants.length) };
  const prod = (id: string) => catalog.products.find((p) => p.id === id);
  const chanName = (k: string) => MANUAL_CHANNELS.find((c) => c[0] === k)?.[1] ?? k;

  const prompt = () => salesPrompt({ brand: bundle.tenant.name, catalog: lite, campaigns: promptCampaigns(campaigns, Date.now()), today: limaToday() });

  const copyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(prompt());
      toast("Prompt copiado. Pégalo en un chat nuevo de Claude o ChatGPT");
    } catch {
      setShowPrompt(true);
      toast("No se pudo copiar: selecciónalo abajo y cópialo");
    }
  };

  const review = (csv = text) => {
    if (!csv.trim()) return toast("Pega el CSV o elige un archivo");
    setResult(readSalesCsv(csv, { catalog: lite, price, today: limaToday() }));
  };

  const pickFile = async (f: File | undefined) => {
    if (!f) return;
    const csv = await f.text();
    setText(csv);
    review(csv);
  };

  const refs = new Set(sales.map((s) => s.ref).filter(Boolean));
  const fresh = result?.sales.filter((s) => !refs.has(s.ref)) ?? [];
  const dupes = (result?.sales.length ?? 0) - fresh.length;
  const total = (s: ReadResult["sales"][number]) => s.lines.reduce((a, l) => a + l.price * l.qty, 0) + s.dIn;
  const sum = fresh.reduce((a, s) => a + total(s), 0);
  const withCamp = fresh.filter((s) => s.lines.some((l) => l.campaignId)).length;

  const save = async () => {
    if (!fresh.length) return;
    setSaving(true);
    const r = await add(fresh, "csv");
    setSaving(false);
    if (!r) return;
    toast(`${r.added} ${r.added === 1 ? "venta registrada" : "ventas registradas"}${r.skipped ? ` · ${r.skipped} ya estaban` : ""}`);
    router.push("/admin/ventas");
  };

  return (
    <AdminPage title="Importar ventas" back={{ href: "/admin/ventas", label: "Ventas" }}>
      <div className="a-head">
        <div className="stack g1">
          <BackLink href="/admin/ventas" label="Ventas" />
          <h1 className="a-h1">Importar ventas</h1>
          <p className="a-sub">Carga varias ventas de una vez: las de la semana, una feria o lo que anotaste en el cuaderno.</p>
        </div>
      </div>
      {!available && <div className="a-banner warn" role="status">Falta aplicar la migración 0009_manual_sales en Supabase para guardar ventas.</div>}
      <div className="a-cols even">
        <section className="a-card" aria-labelledby="im-ia">
          <h2 className="a-h2" id="im-ia">Con tu IA (Claude o ChatGPT)</h2>
          <ol className="stack g2" style={{ margin: 0, paddingLeft: 20, fontSize: 14 }}>
            <li>Copia el prompt. Ya trae tus productos, precios y campañas de hoy.</li>
            <li>Pégalo en un chat nuevo y cuéntale tus ventas como se las contarías a alguien del equipo. También puedes mandarle una foto de tus apuntes.</li>
            <li>Pega aquí el CSV que te devuelva y revísalo.</li>
          </ol>
          <div className="row g2 wrap-row">
            <button className="a-btn primary" type="button" onClick={() => void copyPrompt()}>Copiar prompt para tu IA</button>
            <button className="a-btn ghost" type="button" aria-expanded={showPrompt} onClick={() => setShowPrompt((v) => !v)}>{showPrompt ? "Ocultar prompt" : "Ver prompt"}</button>
          </div>
          {showPrompt && <textarea className="a-textarea" readOnly rows={10} value={prompt()} aria-label="Prompt para tu IA" onFocus={(e) => e.currentTarget.select()} />}
          <p className="a-cap">Si cambias precios o campañas, vuelve a copiarlo. También puedes mandarle el CSV al bot de Telegram de alertas: escríbele /prompt para empezar.</p>
        </section>
        <section className="a-card" aria-labelledby="im-csv">
          <h2 className="a-h2" id="im-csv">Pega o sube el CSV</h2>
          <div className="a-field">
            <label htmlFor="im-text">CSV</label>
            <textarea id="im-text" className="a-textarea" rows={7} value={text} spellCheck={false} style={{ fontFamily: "ui-monospace, monospace", fontSize: 13 }}
              placeholder={"fecha,venta,canal,cliente,pago,producto,opcion,cantidad,precio,…"} onChange={(e) => { setText(e.target.value); setResult(null); }} />
          </div>
          <div className="row g2 wrap-row">
            <button className="a-btn primary" type="button" onClick={() => review()}>Revisar</button>
            <button className="a-btn" type="button" onClick={() => file.current?.click()}>Elegir archivo</button>
            <input ref={file} type="file" accept=".csv,text/csv,text/plain" hidden onChange={(e) => { void pickFile(e.target.files?.[0]); e.target.value = ""; }} />
            <button className="a-btn ghost" type="button" onClick={() => download(`plantilla-ventas-${bundle.tenant.slug}.csv`, templateCsv(lite, limaToday()))}>Descargar plantilla</button>
          </div>
          <p className="a-cap">Sirve el CSV que exportas en Ventas, la plantilla llenada en Excel o el que te arma tu IA. Si dejas el precio vacío, se usa el del día con su campaña.</p>
        </section>
      </div>

      {result && (
        <section className="a-card flush" aria-labelledby="im-rev" aria-live="polite">
          <div className="a-card-h" style={{ flexWrap: "wrap" }}>
            <div className="stack g1">
              <h2 className="a-h2" id="im-rev">Revisión</h2>
              <p className="a-cap">
                {fresh.length} {fresh.length === 1 ? "venta nueva" : "ventas nuevas"} · {money(sum)}
                {withCamp ? ` · ${withCamp} con campaña` : ""}
                {dupes ? ` · ${dupes} ya ${dupes === 1 ? "estaba cargada" : "estaban cargadas"}` : ""}
                {result.errors.length ? ` · ${result.errors.length} ${result.errors.length === 1 ? "fila con error" : "filas con error"}` : ""}
              </p>
            </div>
            <button className="a-btn primary" type="button" disabled={!fresh.length || saving || !available} onClick={() => void save()}>
              {saving ? "Guardando…" : fresh.length ? `Registrar ${fresh.length} ${fresh.length === 1 ? "venta" : "ventas"}` : "Nada nuevo para registrar"}
            </button>
          </div>
          {result.errors.length > 0 && (
            <div className="a-banner err" role="alert" style={{ margin: 16, flexDirection: "column", gap: 4 }}>
              <b>Estas filas no se van a cargar. Corrígelas y vuelve a revisar:</b>
              <ul style={{ margin: 0, paddingLeft: 18 }}>{result.errors.map((e, i) => <li key={i}>{e.row ? `Fila ${e.row}: ` : ""}{e.message}</li>)}</ul>
            </div>
          )}
          {result.warnings.length > 0 && (
            <div className="a-banner warn" style={{ margin: 16, flexDirection: "column", gap: 4 }}>
              <ul style={{ margin: 0, paddingLeft: 18 }}>{result.warnings.map((e, i) => <li key={i}>Fila {e.row}: {e.message}</li>)}</ul>
            </div>
          )}
          {result.sales.length > 0 && (
            <div className="a-table">
              <div className="a-tr head" style={{ gridTemplateColumns: COLS }}><span>Fecha</span><span>Detalle</span><span>Canal</span><span>Total</span><span>Estado</span></div>
              {result.sales.map((s) => {
                const dup = refs.has(s.ref);
                const camps = [...new Set(s.lines.map((l) => l.campaign).filter(Boolean))];
                return (
                  <div key={s.ref} className="a-tr" style={{ gridTemplateColumns: COLS, opacity: dup ? 0.6 : 1 }}>
                    <span className="c-d">{dayLabel(s.day)}</span>
                    <span className="stack">
                      <b>{s.lines.map((l) => `${prod(l.productId)?.name ?? l.productId}${(prod(l.productId)?.variants.length ?? 0) > 1 ? ` (${prod(l.productId)?.variants.find((v) => v.id === l.variantId)?.label})` : ""} x${l.qty}`).join(" + ")}</b>
                      <span className="a-cap">{[s.pay, s.dIn ? `delivery ${money(s.dIn)}` : "", s.client, camps.length ? `campaña ${camps.join(", ")}` : "", s.note].filter(Boolean).join(" · ") || "—"}</span>
                      <span className="c-m a-cap">{dayLabel(s.day)} · {chanName(s.channel)} · filas {s.rows.join(", ")}</span>
                    </span>
                    <span className="c-d"><span className="st nuevo">{chanName(s.channel)}</span></span>
                    <span className="money" style={{ fontWeight: 700 }}>{money(total(s))}</span>
                    <span>{dup ? <span className="st cancelado">Ya cargada</span> : <span className="st pagado">Nueva</span>}</span>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}
      <p className="a-cap">¿Una sola venta? Usa <Link href="/admin/ventas/nueva">Registrar venta</Link>.</p>
    </AdminPage>
  );
}
