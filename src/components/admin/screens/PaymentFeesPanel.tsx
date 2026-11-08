"use client";

import { useState } from "react";
import { money } from "@/lib/admin/format";
import { deductions, normalizeFees, PAY_METHOD_LABELS, type PayMethodKey, type PaymentFees } from "@/lib/sales/fees";
import { Switch } from "../AdminPage";
import { useAdmin } from "../AdminContext";
import { usePaymentFees } from "../AdminFees";

const EXAMPLE = 100;
type Form = { igvRate: string; rules: Record<PayMethodKey, { igv: boolean; pct: string; fixed: string }> };

const toForm = (f: PaymentFees): Form => ({
  igvRate: String(f.igvRate),
  rules: Object.fromEntries(Object.entries(f.rules).map(([k, r]) => [k, { igv: r.igv, pct: r.pct ? String(r.pct) : "", fixed: r.fixed ? String(r.fixed) : "" }])) as Form["rules"],
});
const fromForm = (f: Form): PaymentFees => normalizeFees({ igvRate: f.igvRate.replace(",", "."), rules: Object.fromEntries(Object.entries(f.rules).map(([k, r]) => [k, { igv: r.igv, pct: r.pct.replace(",", "."), fixed: r.fixed.replace(",", ".") }])) });
const bad = (v: string) => v.trim() !== "" && !(parseFloat(v.replace(",", ".")) >= 0);

/** Ajustes › Medios de pago: qué se descuenta de cada venta según cómo te pagaron. */
export function PaymentFeesPanel() {
  const { toast } = useAdmin();
  const { fees, hydrated, save } = usePaymentFees();
  // Formulario local: se rellena con lo guardado y se reinicia cuando cambia lo guardado.
  const [form, setForm] = useState<Form | null>(null);
  const [saved, setSaved] = useState(fees);
  if (saved !== fees) {
    setSaved(fees);
    setForm(null);
  }
  const f = form ?? toForm(fees);
  const dirty = form !== null && JSON.stringify(fromForm(form)) !== JSON.stringify(fees);
  const invalid = bad(f.igvRate) || Object.values(f.rules).some((r) => bad(r.pct) || bad(r.fixed));
  const setRule = (k: PayMethodKey, patch: Partial<Form["rules"][PayMethodKey]>) => setForm({ ...f, rules: { ...f.rules, [k]: { ...f.rules[k], ...patch } } });
  const preview = fromForm(f);
  const [busy, setBusy] = useState(false);

  const onSave = async () => {
    setBusy(true);
    const ok = await save(preview);
    setBusy(false);
    if (ok) toast("Comisiones e IGV guardados");
  };

  return (
    <section className="a-card flush" aria-labelledby="aj-fees">
      <div className="a-card-h" style={{ flexWrap: "wrap" }}>
        <div className="stack g1">
          <h2 className="a-h2" id="aj-fees">IGV y comisiones por medio de pago</h2>
          <p className="a-cap">Se descuentan en Ventas y márgenes, según cómo te pagó el cliente, en la web y en las ventas que registras a mano. Pon la comisión que te cobra Culqi en la web y la de tu POS para las ventas externas, con su IGV si te lo cobran.</p>
        </div>
      </div>
      <div className="fee-igv">
        <div><b>Tasa de IGV</b><p className="a-cap">Los precios ya incluyen el IGV: de cada venta que lo descuenta se resta monto − monto ÷ (1 + tasa).</p></div>
        <div className="a-prefix"><input inputMode="decimal" value={f.igvRate} onChange={(e) => setForm({ ...f, igvRate: e.target.value })} aria-label="Tasa de IGV en %" aria-invalid={bad(f.igvRate)} disabled={!hydrated} /><span style={{ borderRight: 0, borderLeft: "1px solid var(--a-border-2)" }}>%</span></div>
      </div>
      <div className="rate fee head"><span>Medio de pago</span><span>Comisión</span><span>Fijo por venta</span><span>En una venta de {money(EXAMPLE)}</span><span>IGV</span></div>
      {PAY_METHOD_LABELS.map(([k, label, hint]) => {
        const r = f.rules[k];
        const d = deductions(EXAMPLE, preview.rules[k], preview.igvRate, true);
        const off = !d.igv && !d.fee;
        return (
          <div key={k} className={`rate fee ${off ? "off" : ""}`}>
            <span className="nm"><b>{label}</b>{hint && <><br /><span className="a-cap">{hint}</span></>}</span>
            <div><span className="m-lbl">Comisión</span><div className="a-prefix"><input inputMode="decimal" placeholder="0" value={r.pct} onChange={(e) => setRule(k, { pct: e.target.value })} aria-label={`Comisión de ${label} en %`} aria-invalid={bad(r.pct)} disabled={!hydrated} /><span style={{ borderRight: 0, borderLeft: "1px solid var(--a-border-2)" }}>%</span></div></div>
            <div><span className="m-lbl">Fijo por venta</span><div className="a-prefix"><span>S/</span><input inputMode="decimal" placeholder="0" value={r.fixed} onChange={(e) => setRule(k, { fixed: e.target.value })} aria-label={`Monto fijo por venta de ${label}`} aria-invalid={bad(r.fixed)} disabled={!hydrated} /></div></div>
            <span className="mg a-cap">{off ? "Sin descuentos" : <>{d.igv > 0 && <>IGV − {money(d.igv)}<br /></>}{d.fee > 0 && <>Comisión − {money(d.fee)}<br /></>}<b>Te queda {money(EXAMPLE - d.igv - d.fee)}</b></>}</span>
            <span className="swc"><Switch on={r.igv} disabled={!hydrated} onChange={(v) => setRule(k, { igv: v })} label={`Descontar IGV en ${label}`} /></span>
          </div>
        );
      })}
      <div className="row g2 wrap-row" style={{ padding: "16px 20px", background: "#FAFAF8" }}>
        <button className="a-btn primary" type="button" disabled={!dirty || invalid || busy} onClick={() => void onSave()}>{busy ? "Guardando…" : "Guardar"}</button>
        {dirty && <button className="a-btn ghost" type="button" onClick={() => setForm(null)}>Descartar cambios</button>}
        {invalid && <span className="a-cap" role="alert">Revisa los montos: usa números como 3.99.</span>}
      </div>
    </section>
  );
}
