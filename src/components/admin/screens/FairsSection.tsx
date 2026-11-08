"use client";

import { useEffect, useState } from "react";
import { moneyShort } from "@/lib/admin/format";
import { FAIR_STATE, fairDays, fairFixed, fairRange, fairState, type Fair } from "@/lib/fairs";
import { limaToday } from "@/lib/sales/pricer";
import { useAdmin } from "../AdminContext";
import { useFairs } from "../AdminFairs";
import { AIPlus, AITrash } from "../AdminIcons";

/** Una línea vendida en feria, ya filtrada por línea/campaña. `fair` = id de la feria vigente ese día ("" = ninguna). */
export type FairRow = { fair: string; rev: number; cost: number; units: number };

type Draft = { id: string; isNew: boolean; name: string; place: string; startsOn: string; endsOn: string; costs: { label: string; amount: string }[]; createdAt: string; note: string };

const newId = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `f${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`);
const toDraft = (f: Fair): Draft => ({ ...f, isNew: false, costs: f.costs.map((c) => ({ label: c.label, amount: String(c.amount) })) });
const blank = (): Draft => {
  const today = limaToday();
  return { id: newId(), isNew: true, name: "", place: "", startsOn: today, endsOn: today, costs: [{ label: "Stand", amount: "" }, { label: "Movilidad", amount: "" }], createdAt: new Date().toISOString(), note: "" };
};

export function FairsSection({ rows, unassigned }: { rows: FairRow[]; /** Ventas de feria cuya fecha no cae en ninguna feria. */ unassigned: number }) {
  const { toast } = useAdmin();
  const { fairs, save, remove, hydrated, available } = useFairs();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [today, setToday] = useState<string | null>(null);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- la fecha es solo del navegador
  useEffect(() => setToday(limaToday()), []);
  const sum = (a: FairRow[], k: "rev" | "cost" | "units") => a.reduce((x, r) => x + r[k], 0);

  const patch = (p: Partial<Draft>) => setDraft((d) => (d ? { ...d, ...p } : d));
  const patchCost = (i: number, p: Partial<Draft["costs"][number]>) => setDraft((d) => (d ? { ...d, costs: d.costs.map((c, j) => (j === i ? { ...c, ...p } : c)) } : d));

  const submit = async () => {
    if (!draft) return;
    const name = draft.name.trim();
    if (!name) return toast("Ponle nombre a la feria");
    if (!draft.startsOn || !draft.endsOn) return toast("Elige las fechas de la feria");
    if (draft.endsOn < draft.startsOn) return toast("La fecha de fin no puede ser antes del inicio");
    const costs = draft.costs
      .map((c) => ({ label: c.label.trim(), amount: Math.max(0, parseFloat(c.amount.replace(",", ".")) || 0) }))
      .filter((c) => c.label || c.amount);
    if (costs.some((c) => !c.label)) return toast("Ponle nombre a cada costo (Stand, Movilidad…)");
    setBusy(true);
    const ok = await save({ id: draft.id, name, place: draft.place.trim(), startsOn: draft.startsOn, endsOn: draft.endsOn, costs, note: draft.note, createdAt: draft.createdAt });
    setBusy(false);
    if (!ok) return;
    toast(draft.isNew ? "Feria creada. Las ventas de Feria de esas fechas se cargan aquí" : "Feria guardada");
    setDraft(null);
  };

  const del = async () => {
    if (!draft || draft.isNew) return setDraft(null);
    if (!window.confirm(`¿Borrar la feria «${draft.name}»? Sus ventas no se borran: quedan como ventas de Feria sin feria asignada.`)) return;
    setBusy(true);
    const ok = await remove(draft.id);
    setBusy(false);
    if (ok) {
      toast("Feria borrada");
      setDraft(null);
    }
  };

  return (
    <section className="a-card" aria-labelledby="v-fair">
      <div className="a-card-h" style={{ flexWrap: "wrap" }}>
        <div className="stack g1">
          <h2 className="a-h2" id="v-fair">Ferias y eventos</h2>
          <p className="a-cap">Crea cada feria con sus fechas y costos fijos. Las ventas con canal Feria se cargan solas en la feria de su fecha.</p>
        </div>
        {!draft && <button className="a-btn sm" type="button" onClick={() => setDraft(blank())} disabled={!available}><AIPlus size="sm" /> Nueva feria</button>}
      </div>
      {!available && <p className="bad-pill" style={{ alignSelf: "flex-start" }}>Falta aplicar la migración de ferias (0012) en la base</p>}

      {draft && (
        <form className="stack g3 fair-form" onSubmit={(e) => { e.preventDefault(); void submit(); }} aria-label={draft.isNew ? "Nueva feria" : `Editar ${draft.name}`}>
          <div className="a-grid2">
            <div className="a-field"><label htmlFor="fr-name">Nombre de la feria</label><input id="fr-name" className="a-input" value={draft.name} placeholder="Ej.: Feria de Halloween" onChange={(e) => patch({ name: e.target.value })} autoFocus /></div>
            <div className="a-field"><label htmlFor="fr-place">Lugar <span className="a-cap">(opcional)</span></label><input id="fr-place" className="a-input" value={draft.place} placeholder="Ej.: Parque Kennedy, Miraflores" onChange={(e) => patch({ place: e.target.value })} /></div>
            <div className="a-field"><label htmlFor="fr-start">Desde</label><input id="fr-start" className="a-input" type="date" value={draft.startsOn} onChange={(e) => { const v = e.target.value; patch({ startsOn: v, ...(v && draft.endsOn < v ? { endsOn: v } : {}) }); }} /></div>
            <div className="a-field"><label htmlFor="fr-end">Hasta <span className="a-cap">(incluido)</span></label><input id="fr-end" className="a-input" type="date" min={draft.startsOn} value={draft.endsOn} onChange={(e) => patch({ endsOn: e.target.value })} /></div>
          </div>
          <fieldset className="stack g2" style={{ border: 0, padding: 0, margin: 0 }}>
            <legend className="a-h3" style={{ marginBottom: 6 }}>Costos fijos de la feria</legend>
            {draft.costs.map((c, i) => (
              <div className="fair-cost" key={i}>
                <input className="a-input" aria-label={`Concepto del costo ${i + 1}`} value={c.label} placeholder="Ej.: Stand" onChange={(e) => patchCost(i, { label: e.target.value })} />
                <div className="fair-amt"><span aria-hidden="true">S/</span><input className="a-input" aria-label={`Monto de ${c.label || `costo ${i + 1}`} en soles`} inputMode="decimal" value={c.amount} placeholder="0.00" onChange={(e) => patchCost(i, { amount: e.target.value })} /></div>
                <button className="a-btn sm ghost" type="button" aria-label={`Quitar ${c.label || `costo ${i + 1}`}`} onClick={() => setDraft((d) => (d ? { ...d, costs: d.costs.filter((_, j) => j !== i) } : d))}><AITrash size="sm" /></button>
              </div>
            ))}
            <div><button className="a-btn sm ghost" type="button" onClick={() => setDraft((d) => (d ? { ...d, costs: [...d.costs, { label: "", amount: "" }] } : d))}><AIPlus size="sm" /> Agregar costo</button></div>
            <p className="a-cap">Total fijo: <b>{moneyShort(draft.costs.reduce((a, c) => a + (parseFloat(c.amount.replace(",", ".")) || 0), 0))}</b>{draft.startsOn && draft.endsOn >= draft.startsOn ? ` · ${fairRange(draft)}` : ""}</p>
          </fieldset>
          <div className="row between wrap-row g2">
            {!draft.isNew ? <button className="a-btn sm danger" type="button" onClick={() => void del()} disabled={busy}><AITrash size="sm" /> Borrar feria</button> : <span />}
            <div className="row g2">
              <button className="a-btn ghost" type="button" onClick={() => setDraft(null)} disabled={busy}>Cancelar</button>
              <button className="a-btn primary" type="submit" disabled={busy}>{busy ? "Guardando…" : draft.isNew ? "Crear feria" : "Guardar"}</button>
            </div>
          </div>
        </form>
      )}

      {hydrated && !fairs.length && !draft && available && (
        <p className="a-cap">Todavía no tienes ferias. Crea una con sus fechas y costos (stand, movilidad…) para ver si conviene volver.</p>
      )}

      {fairs.map((f) => {
        const a = rows.filter((r) => r.fair === f.id);
        const rev = sum(a, "rev");
        const con = rev - sum(a, "cost");
        const fixed = fairFixed(f);
        const net = con - fixed;
        const st = today ? fairState(f, today) : null;
        const verdict = st === "ended" || a.length ? (net > 0 ? ["ok-pill", st === "ended" ? "Rentable · conviene volver" : "Ya cubrió costos"] : ["bad-pill", st === "ended" ? "No cubrió costos" : "Aún no cubre costos"]) : null;
        return (
          <div className="stack g2 fair-item" key={f.id}>
            <div className="row between wrap-row g2">
              <div>
                <b>{f.name}{f.place ? ` · ${f.place}` : ""}</b>
                <p className="a-cap">{st && <span className={`st ${FAIR_STATE[st][1]}`} style={{ marginRight: 6 }}>{FAIR_STATE[st][0]}</span>}{fairRange(f)}</p>
              </div>
              <div className="row g2">
                {verdict && <span className={verdict[0]}>{verdict[1]}</span>}
                <button className="a-btn sm ghost" type="button" onClick={() => setDraft(toDraft(f))} disabled={!!draft} aria-label={`Editar ${f.name}`}>Editar</button>
              </div>
            </div>
            <div className="fair">
              <div><span className="a-cap">Ventas</span><b className="money">{moneyShort(rev)}</b><span className="a-cap">{sum(a, "units") === 1 ? "1 unidad" : `${sum(a, "units")} unidades`}</span></div>
              <div><span className="a-cap">Contribución de productos</span><b className="money">{moneyShort(con)}</b><span className="a-cap">Margen {rev ? Math.round((con / rev) * 100) : 0}%</span></div>
              <div><span className="a-cap">Costos fijos</span><b className="money">{fixed ? `− ${moneyShort(fixed)}` : moneyShort(0)}</b><span className="a-cap">{f.costs.length ? f.costs.map((c) => `${c.label} ${moneyShort(c.amount)}`).join(" · ") : "Sin costos cargados"}</span></div>
              <div style={{ background: net >= 0 ? "#E4F2E7" : "#FBE9E7" }}><span className="a-cap">Contribución neta</span><b className="money">{net < 0 ? "− " : ""}{moneyShort(Math.abs(net))}</b><span className="a-cap">{net < 0 ? "− " : ""}{moneyShort(Math.abs(net) / fairDays(f))} por día</span></div>
            </div>
          </div>
        );
      })}

      {unassigned > 0 && (
        <p className="a-cap">
          {unassigned === 1 ? "1 venta de Feria no cae" : `${unassigned} ventas de Feria no caen`} en las fechas de ninguna feria. Crea la feria (o ajusta sus fechas) y se cargan solas.
        </p>
      )}
    </section>
  );
}
