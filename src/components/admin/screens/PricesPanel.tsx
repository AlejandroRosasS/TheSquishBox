"use client";

/* eslint-disable @next/next/no-img-element */
import { useEffect, useMemo, useState } from "react";
import type { Campaign } from "@/lib/types";
import type { AdminCatalog } from "@/lib/admin/types";
import { asset } from "@/lib/assets";
import { CAMPAIGN_STATE, campaignRange, campaignState, discountPct, isoToLima, limaToIso } from "@/lib/campaigns";
import { useAdmin, useAdminCatalog } from "../AdminContext";
import { useCampaigns } from "../AdminCampaigns";
import { AIPlus, AISearch, AITrash } from "../AdminIcons";

/** Precio escrito en un campo → número (vacío = sin precio). */
const parse = (s: string): number | null => {
  const t = s.replace(",", ".").trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : NaN;
};
const show = (n: number | undefined | null) => (n === undefined || n === null ? "" : String(n));

type Drafts = { regular: Record<string, string>; cost: Record<string, string>; offer: Record<string, Record<string, string>>; campaigns: Campaign[] };
const k = (pid: string, vid: string) => `${pid}\u0000${vid}`;

function newCampaign(): Campaign {
  const d = new Date(Date.now() - 5 * 3600_000);
  const day = d.toISOString().slice(0, 10);
  const end = new Date(d.getTime() + 7 * 86400_000).toISOString().slice(0, 10);
  const id = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `c${Date.now()}`;
  return { id, name: "", startsAt: limaToIso(`${day}T00:00`), endsAt: limaToIso(`${end}T23:59`), prices: {} };
}

/** Admin › Productos › Precios: una sola tabla con el precio regular y el de oferta de la campaña elegida. */
export function PricesPanel() {
  const { bundle, toast } = useAdmin();
  const { catalog, setCatalog, hydrated } = useAdminCatalog();
  const camp = useCampaigns();
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- la hora es solo del navegador
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);

  const [drafts, setDrafts] = useState<Drafts | null>(null);
  const [sel, setSel] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const campaigns = drafts?.campaigns ?? camp.campaigns;
  const t = now ?? 0;

  // Al cargar: elegir la campaña activa (o la próxima, o la más reciente).
  useEffect(() => {
    if (sel !== null || !camp.hydrated || !now || !camp.campaigns.length) return;
    const byState = (s: string) => camp.campaigns.filter((c) => campaignState(c, now) === s);
    const pick = byState("active")[0] ?? byState("scheduled").sort((a, b) => a.startsAt.localeCompare(b.startsAt))[0] ?? camp.campaigns[0];
    // eslint-disable-next-line react-hooks/set-state-in-effect -- selección inicial al terminar de cargar
    setSel(pick.id);
  }, [camp.hydrated, camp.campaigns, now, sel]);

  const current = campaigns.find((c) => c.id === sel) ?? null;
  const ordered = useMemo(() => {
    const rank = { active: 0, scheduled: 1, ended: 2 } as const;
    return [...campaigns].sort((a, b) => rank[campaignState(a, t)] - rank[campaignState(b, t)] || b.startsAt.localeCompare(a.startsAt));
  }, [campaigns, t]);

  const edit = (fn: (d: Drafts) => Drafts) => setDrafts((d) => fn(d ?? { regular: {}, cost: {}, offer: {}, campaigns: camp.campaigns }));
  const regularOf = (pid: string, vid: string, base: number) => drafts?.regular[k(pid, vid)] ?? show(base);
  const costOf = (pid: string, vid: string) => drafts?.cost[k(pid, vid)] ?? show(catalog.costs[pid]?.[vid]);
  const offerOf = (c: Campaign, pid: string, vid: string) => drafts?.offer[c.id]?.[k(pid, vid)] ?? show(c.prices[pid]?.[vid]);
  const patchCampaign = (id: string, patch: Partial<Campaign>) => edit((d) => ({ ...d, campaigns: d.campaigns.map((c) => (c.id === id ? { ...c, ...patch } : c)) }));

  const addCampaign = () => {
    const c = newCampaign();
    edit((d) => ({ ...d, campaigns: [c, ...d.campaigns] }));
    setSel(c.id);
    setTimeout(() => document.getElementById("pc-name")?.focus(), 0);
  };
  const removeCampaign = (c: Campaign) => {
    if (!window.confirm(`¿Borrar la campaña «${c.name || "sin nombre"}»? Las ventas ya registradas no cambian.`)) return;
    edit((d) => ({ ...d, campaigns: d.campaigns.filter((x) => x.id !== c.id) }));
    setSel(null);
  };

  const rows = catalog.products
    .filter((p) => p.variants.length && (!q || p.name.toLowerCase().includes(q.toLowerCase())))
    .flatMap((p) => p.variants.map((v, i) => ({ p, v, first: i === 0 })));

  // Validación y cambios pendientes
  const errors: string[] = [];
  for (const c of campaigns) {
    if (!c.name.trim()) errors.push("Ponle nombre a la campaña");
    if (!(Date.parse(c.endsAt) > Date.parse(c.startsAt))) errors.push(`«${c.name || "Campaña"}»: la fecha de fin debe ser después del inicio`);
  }
  for (const { p, v } of rows) {
    const r = parse(regularOf(p.id, v.id, v.price));
    if (r === null || Number.isNaN(r)) errors.push(`Revisa el precio de ${p.name}${p.variants.length > 1 ? ` · ${v.label}` : ""}`);
    if (Number.isNaN(parse(costOf(p.id, v.id)))) errors.push(`Revisa el costo de ${p.name}${p.variants.length > 1 ? ` · ${v.label}` : ""}`);
    for (const c of campaigns) {
      const o = parse(offerOf(c, p.id, v.id));
      if (Number.isNaN(o)) errors.push(`Revisa el precio de oferta de ${p.name}`);
    }
  }
  const dirty = !!drafts && (Object.keys(drafts.regular).length > 0 || Object.keys(drafts.cost).length > 0 || Object.keys(drafts.offer).length > 0 || JSON.stringify(drafts.campaigns) !== JSON.stringify(camp.campaigns));

  const saveAll = async () => {
    if (!drafts) return;
    if (errors.length) return toast(errors[0]);
    setBusy(true);
    // Campañas con sus precios de oferta (vacío = la opción no participa).
    const nextCampaigns = drafts.campaigns.map((c) => {
      const ed = drafts.offer[c.id];
      if (!ed) return c;
      const prices: Campaign["prices"] = JSON.parse(JSON.stringify(c.prices));
      for (const [key, val] of Object.entries(ed)) {
        const [pid, vid] = key.split("\u0000");
        const n = parse(val);
        if (n === null || Number.isNaN(n)) {
          if (prices[pid]) delete prices[pid][vid];
          if (prices[pid] && !Object.keys(prices[pid]).length) delete prices[pid];
        } else (prices[pid] ??= {})[vid] = n;
      }
      return { ...c, name: c.name.trim(), prices };
    });
    let ok = true;
    if (JSON.stringify(nextCampaigns) !== JSON.stringify(camp.campaigns)) ok = await camp.save(nextCampaigns);
    if (ok && (Object.keys(drafts.regular).length || Object.keys(drafts.cost).length)) {
      const reg = drafts.regular;
      // Costos internos (no se ven en la tienda). Vacío = sin costo cargado.
      const costs: AdminCatalog["costs"] = JSON.parse(JSON.stringify(catalog.costs));
      for (const [key, val] of Object.entries(drafts.cost)) {
        const [pid, vid] = key.split("\u0000");
        const n = parse(val);
        if (n === null || Number.isNaN(n)) {
          if (costs[pid]) delete costs[pid][vid];
          if (costs[pid] && !Object.keys(costs[pid]).length) delete costs[pid];
        } else (costs[pid] ??= {})[vid] = n;
      }
      setCatalog((prev: AdminCatalog) => ({
        ...prev,
        costs,
        products: prev.products.map((p) => {
          if (!p.variants.some((v) => reg[k(p.id, v.id)] !== undefined)) return p;
          return { ...p, variants: p.variants.map((v) => (reg[k(p.id, v.id)] !== undefined ? { ...v, price: parse(reg[k(p.id, v.id)]) ?? v.price } : v)) };
        }),
      }));
    }
    setBusy(false);
    if (ok) {
      setDrafts(null);
      toast("Precios guardados");
    }
  };

  const cols = current ? "minmax(0, 1.6fr) 120px 130px 130px 90px 80px" : "minmax(0, 1.6fr) 120px 130px 80px";
  const st = current && now ? campaignState(current, now) : null;
  const overlap = current && now
    ? campaigns.filter((c) => c.id !== current.id && Date.parse(c.startsAt) < Date.parse(current.endsAt) && Date.parse(c.endsAt) > Date.parse(current.startsAt))
    : [];

  return (
    <div className="stack g5">
      <section className="a-card" aria-labelledby="pc-h">
        <div className="a-card-h" style={{ flexWrap: "wrap" }}>
          <div className="stack g1">
            <h2 className="a-h2" id="pc-h">Campañas de oferta</h2>
            <p className="a-cap">Cada campaña tiene inicio, fin y su precio de oferta. Mientras está activa, la tienda cobra ese precio y muestra el regular tachado.</p>
          </div>
          <button className="a-btn sm" type="button" onClick={addCampaign} disabled={!camp.available}><AIPlus size="sm" /> Nueva campaña</button>
        </div>
        {!camp.available && <p className="bad-pill" style={{ alignSelf: "flex-start" }}>Falta aplicar la migración de campañas (0008) en la base</p>}
        {campaigns.length > 0 ? (
          <div className="row g2 wrap-row" role="group" aria-label="Campaña a editar">
            {ordered.map((c) => {
              const s = now ? campaignState(c, now) : null;
              return (
                <button key={c.id} type="button" className={`a-chip ${sel === c.id ? "on" : ""}`} aria-pressed={sel === c.id} onClick={() => setSel(c.id)}>
                  {c.name || "Campaña sin nombre"}
                  {s && <span className="n">· {CAMPAIGN_STATE[s][0]}</span>}
                </button>
              );
            })}
            <button type="button" className={`a-chip ${sel === null ? "on" : ""}`} aria-pressed={sel === null} onClick={() => setSel(null)}>Solo precio regular</button>
          </div>
        ) : (
          camp.hydrated && <p className="a-cap">Todavía no hay campañas. Crea una para poner precios de oferta por unos días.</p>
        )}
        {current && (
          <div className="stack g3">
            <div className="pc-form">
              <div className="a-field"><label htmlFor="pc-name">Nombre de la campaña</label><input id="pc-name" className="a-input" value={current.name} placeholder="Ej.: Cyber Days" onChange={(e) => patchCampaign(current.id, { name: e.target.value })} /></div>
              <div className="a-field"><label htmlFor="pc-start">Inicio</label><input id="pc-start" className="a-input" type="datetime-local" value={isoToLima(current.startsAt)} onChange={(e) => e.target.value && patchCampaign(current.id, { startsAt: limaToIso(e.target.value) })} /></div>
              <div className="a-field"><label htmlFor="pc-end">Fin</label><input id="pc-end" className="a-input" type="datetime-local" value={isoToLima(current.endsAt)} onChange={(e) => e.target.value && patchCampaign(current.id, { endsAt: limaToIso(e.target.value) })} /></div>
            </div>
            <div className="row between wrap-row g2">
              <p className="a-cap">
                {st && <span className={`st ${CAMPAIGN_STATE[st][1]}`} style={{ marginRight: 8 }}>{CAMPAIGN_STATE[st][0]}</span>}
                {campaignRange(current)} · hora de Perú · deja vacío el precio de oferta de lo que no participa.
              </p>
              <button className="a-btn sm danger" type="button" onClick={() => removeCampaign(current)}><AITrash size="sm" /> Borrar campaña</button>
            </div>
            {overlap.length > 0 && <p className="a-cap">Se cruza con {overlap.map((c) => `«${c.name || "sin nombre"}»`).join(", ")}: si una opción está en las dos, se cobra el precio más bajo.</p>}
          </div>
        )}
      </section>

      <section className="a-card flush" aria-labelledby="pt-h">
        <div className="a-card-h" style={{ flexWrap: "wrap" }}>
          <h2 className="a-h2" id="pt-h">{current ? `Precios · ${current.name || "campaña sin nombre"}` : "Precios"}</h2>
          <div className="a-search" style={{ minWidth: 220 }}><AISearch size="sm" /><input placeholder="Buscar producto" aria-label="Buscar producto" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        </div>
        <div className="a-table pt-table">
          <div className="a-tr head" style={{ gridTemplateColumns: cols }}>
            <span>Producto</span><span>Costo</span><span>Precio regular</span>{current && <><span>Precio oferta</span><span>Descuento</span></>}<span>Margen</span>
          </div>
          {rows.map(({ p, v, first }) => {
            const reg = regularOf(p.id, v.id, v.price);
            const regN = parse(reg);
            const off = current ? offerOf(current, p.id, v.id) : "";
            const offN = parse(off);
            const sell = current && offN !== null && !Number.isNaN(offN) ? offN : regN;
            const costTxt = costOf(p.id, v.id);
            const costN = parse(costTxt);
            const cost = costN === null || Number.isNaN(costN) ? undefined : costN;
            const margin = sell && !Number.isNaN(sell) && cost !== undefined ? Math.round(((sell - cost) / sell) * 100) : null;
            const label = `${p.name}${p.variants.length > 1 ? ` · ${v.label}` : ""}`;
            const high = current && offN !== null && regN !== null && !Number.isNaN(offN) && offN >= regN;
            return (
              <div key={k(p.id, v.id)} className={`a-tr pt-tr ${first ? "" : "sub"}`} style={{ gridTemplateColumns: cols }}>
                <span className="row g3" style={{ minWidth: 0 }}>
                  <span className="av" style={{ width: 40, height: 40, visibility: first ? "visible" : "hidden" }}>{p.images[0] && <img src={asset(bundle.tenant.slug, p.images[0])} alt="" />}</span>
                  <span className="stack" style={{ minWidth: 0, gap: 1 }}>
                    <b style={{ fontWeight: first ? 700 : 500 }}>{first ? p.name || "Producto sin título" : v.label}</b>
                    {first && p.variants.length > 1 && <span className="a-cap">{v.label}</span>}
                    {p.status === "draft" && first && <span className="a-cap">Borrador</span>}
                    <span className="c-m a-cap">{[`Margen ${margin !== null ? `${margin}%` : "—"}`, current && offN !== null && regN && !Number.isNaN(offN) && !high ? `oferta −${discountPct(regN, offN)}%` : ""].filter(Boolean).join(" · ")}</span>
                  </span>
                </span>
                <label className="pt-cell">
                  <span className="c-m a-cap">Costo</span>
                  <span className="a-prefix"><span>S/</span><input inputMode="decimal" placeholder="—" aria-label={`Costo de ${label}`} aria-invalid={Number.isNaN(costN)} value={costTxt} onChange={(e) => { const val = e.target.value; edit((d) => ({ ...d, cost: { ...d.cost, [k(p.id, v.id)]: val } })); }} /></span>
                </label>
                <label className="pt-cell">
                  <span className="c-m a-cap">Regular</span>
                  <span className="a-prefix"><span>S/</span><input inputMode="decimal" aria-label={`Precio regular de ${label}`} aria-invalid={regN === null || Number.isNaN(regN)} value={reg} onChange={(e) => { const val = e.target.value; edit((d) => ({ ...d, regular: { ...d.regular, [k(p.id, v.id)]: val } })); }} /></span>
                </label>
                {current && (
                  <>
                    <label className="pt-cell">
                      <span className="c-m a-cap">Oferta</span>
                      <span className="a-prefix"><span>S/</span><input inputMode="decimal" placeholder="—" aria-label={`Precio de oferta de ${label} en ${current.name || "la campaña"}`} aria-invalid={Number.isNaN(offN) || !!high} value={off} onChange={(e) => { const val = e.target.value; edit((d) => ({ ...d, offer: { ...d.offer, [current.id]: { ...d.offer[current.id], [k(p.id, v.id)]: val } } })); }} /></span>
                    </label>
                    <span className="c-d">{high ? <span className="bad-pill">No baja</span> : offN !== null && regN && !Number.isNaN(offN) ? <span className="ok-pill">−{discountPct(regN, offN)}%</span> : <span className="a-cap">—</span>}</span>
                  </>
                )}
                <span className="a-cap c-d">{margin !== null ? `${margin}%` : "—"}</span>
              </div>
            );
          })}
          {hydrated && !rows.length && <p className="a-cap" style={{ padding: "14px 20px" }}>{q ? "Ningún producto coincide con la búsqueda." : "Todavía no hay productos con precio."}</p>}
        </div>
      </section>

      {dirty && (
        <div className="a-sticky" role="region" aria-label="Cambios sin guardar">
          <span className="a-cap">{errors.length ? errors[0] : "Tienes cambios sin guardar"}</span>
          <div className="row g2">
            <button className="a-btn ghost" type="button" onClick={() => { setDrafts(null); if (sel && !camp.campaigns.some((c) => c.id === sel)) setSel(null); }}>Descartar</button>
            <button className="a-btn primary" type="button" disabled={busy || errors.length > 0} onClick={() => void saveAll()}>{busy ? "Guardando…" : "Guardar precios"}</button>
          </div>
        </div>
      )}
    </div>
  );
}
