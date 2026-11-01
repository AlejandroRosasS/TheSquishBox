"use client";

import { useMemo, useState } from "react";
import { useAdmin } from "../AdminContext";
import { AdminPage } from "../AdminPage";
import { ColorField } from "../ColorField";
import { StorePreview } from "../StorePreview";
import { AIAlert, AICheck } from "../AdminIcons";
import { contrast, readableOn } from "@/lib/color";
import { docKey } from "@/lib/admin/storage";
import { STATUS_LABEL, useDoc } from "@/lib/admin/useDoc";
import { TOKEN_KEYS, type TokenKey, type Tokens } from "@/lib/publishedTheme";
import type { PaletteTokens } from "@/lib/types";
import { useTextsDraft } from "./useTextsDraft";

type Appearance = { key: string | null; tokens: Tokens };

const toTokens = (p: PaletteTokens): Tokens => Object.fromEntries(TOKEN_KEYS.map((k) => [k, p[k]])) as Tokens;

const GROUPS: { title: string; fields: { k: TokenKey; label: string; hint: string }[] }[] = [
  {
    title: "Marca",
    fields: [
      { k: "primary", label: "Principal", hint: "botones, enlaces, badges" },
      { k: "onPrimary", label: "Texto sobre principal", hint: "letras de los botones" },
      { k: "accent", label: "Acento", hint: "detalles y subrayados" },
    ],
  },
  {
    title: "Fondos",
    fields: [
      { k: "bg", label: "Fondo", hint: "toda la página" },
      { k: "surface", label: "Superficie", hint: "tarjetas, carrito, formularios" },
      { k: "border", label: "Borde", hint: "líneas y separadores" },
    ],
  },
  {
    title: "Texto",
    fields: [
      { k: "text", label: "Texto", hint: "títulos y párrafos" },
      { k: "text2", label: "Texto secundario", hint: "descripciones y notas" },
    ],
  },
];

export function AppearanceView() {
  const { bundle, toast } = useAdmin();
  const { tenant } = bundle;
  const presets = tenant.palettes;
  const base: Appearance = useMemo(() => ({ key: tenant.defaultPalette, tokens: toTokens(presets[tenant.defaultPalette]) }), [tenant, presets]);
  const doc = useDoc<Appearance>(docKey(tenant.slug, "appearance"), base);
  const [mode, setMode] = useState<"m" | "d">("m");
  const [justPublished, setJustPublished] = useState(false);
  const texts = useTextsDraft();
  const v = doc.value.tokens;
  const name = doc.value.key ? presets[doc.value.key]?.name ?? "Personalizada" : "Personalizada";

  const set = (k: TokenKey, hex: string) => {
    setJustPublished(false);
    doc.edit((prev) => ({ key: null, tokens: { ...prev.tokens, [k]: hex } }));
  };
  const pick = (key: string) => {
    setJustPublished(false);
    doc.edit({ key, tokens: toTokens(presets[key]) });
  };

  const checks = [
    { label: "Texto sobre botón principal", a: v.onPrimary, b: v.primary, keys: ["onPrimary", "primary"] },
    { label: "Texto sobre el fondo", a: v.text, b: v.bg, keys: ["text", "bg"] },
    { label: "Texto sobre tarjetas (superficie)", a: v.text, b: v.surface, keys: ["text", "surface"] },
    { label: "Texto secundario sobre el fondo", a: v.text2, b: v.bg, keys: ["text2", "bg"] },
    { label: "Enlaces y botones claros (principal sobre fondo)", a: v.primary, b: v.bg, keys: ["primary", "bg"] },
  ].map((c) => {
    const r = contrast(c.a, c.b);
    return { ...c, ratio: `${r.toFixed(1)}:1`, ok: r >= 4.5 };
  });
  const blocked = checks.some((c) => !c.ok);
  const badKeys = new Set(checks.filter((c) => !c.ok).flatMap((c) => c.keys));
  const [stLabel, stCls] = STATUS_LABEL[doc.status];
  const derived = [
    { label: "Hover", css: `color-mix(in oklab, ${v.primary} 82%, black)` },
    { label: "Principal suave", css: `color-mix(in oklab, ${v.primary} 9%, ${v.surface})` },
    { label: "Acento suave", css: `color-mix(in oklab, ${v.accent} 18%, ${v.surface})` },
    { label: "Borde fuerte", css: `color-mix(in oklab, ${v.border} 60%, ${v.text2})` },
  ];

  const footNote = blocked
    ? "No se puede publicar: hay colores que no se leen bien."
    : doc.status === "live"
      ? "La tienda ya muestra esta paleta."
      : "Los clientes verán los cambios solo al publicar.";

  return (
    <AdminPage title="Apariencia" back={{ href: "/admin/ajustes", label: "Ajustes" }} topRight={<span className={`st ${stCls}`}>{stLabel}</span>}>
      <div className="a-head">
        <div className="stack g1">
          <div className="row g3">
            <h1 className="a-h1">Apariencia de la tienda</h1>
            <span className={`st ${stCls} only-d`}>{stLabel}</span>
          </div>
          <p className="a-sub">Cambia los tonos sin ayuda técnica. El logo y este panel no cambian: siempre se ven igual.</p>
        </div>
        <button className="a-btn" type="button" onClick={() => pick(tenant.defaultPalette)}>Restaurar paleta original</button>
      </div>

      {justPublished && (
        <div className="a-banner ok" role="status">
          <AICheck size="sm" />
          <span className="grow"><b>Paleta “{name}” publicada.</b> La tienda ya se ve con estos tonos. <span className="a-cap">(Demo: por ahora solo en este navegador.)</span></span>
          <a className="a-btn sm" href="/" target="_blank" rel="noreferrer">Ver tienda actualizada</a>
        </div>
      )}

      <section className="a-card" aria-labelledby="ap-pal">
        <h2 className="a-h2" id="ap-pal">Paletas</h2>
        <div className="pal-grid">
          {Object.entries(presets).map(([k, p]) => {
            const on = doc.value.key === k;
            return (
              <button key={k} className={`pal-card ${on ? "on" : ""}`} type="button" onClick={() => pick(k)} aria-pressed={on}>
                <span className="swatch-row" aria-hidden="true">
                  <i style={{ background: p.bg }} /><i style={{ background: p.primary }} /><i style={{ background: p.accent }} /><i style={{ background: p.text }} />
                </span>
                <span className="row between">
                  <b style={{ fontSize: 13 }}>{p.name}</b>
                  {k === tenant.defaultPalette && <span className="a-cap">Original</span>}
                </span>
              </button>
            );
          })}
        </div>
        {!doc.value.key && <p className="a-cap">Estás usando una paleta <b>personalizada</b>. Elige una de arriba para volver a empezar desde ella.</p>}
      </section>

      <div className="ap-cols">
        <div className="stack g5">
          <section className="a-card" aria-labelledby="ap-cus">
            <h2 className="a-h2" id="ap-cus">Personalizar</h2>
            <p className="a-cap">Los 8 colores de la tienda. Los tonos intermedios (hover, fondos suaves, foco) se calculan solos.</p>
            {GROUPS.map((g) => (
              <fieldset key={g.title} className="stack g3" style={{ border: 0, padding: 0, margin: 0 }}>
                <legend className="a-label" style={{ marginBottom: 8 }}>{g.title}</legend>
                <div className="tok-grid">
                  {g.fields.map((f) => (
                    <ColorField key={f.k} id={`tok-${f.k}`} label={f.label} hint={f.hint} value={v[f.k]} onChange={(hex) => set(f.k, hex)} bad={badKeys.has(f.k)} />
                  ))}
                </div>
              </fieldset>
            ))}
            <button className="a-btn sm" type="button" style={{ alignSelf: "flex-start" }} onClick={() => set("onPrimary", readableOn(v.primary))}>
              Elegir solo el texto sobre principal que mejor se lee
            </button>
            <p className="a-label" style={{ marginTop: 4 }}>Tonos derivados</p>
            <div className="der-row">
              {derived.map((d) => (
                <div key={d.label}><i style={{ background: d.css }} />{d.label}</div>
              ))}
            </div>
          </section>

          <section className="a-card" aria-labelledby="ap-leg">
            <div className="a-card-h">
              <h2 className="a-h2" id="ap-leg">Legibilidad</h2>
              <span className={blocked ? "bad-pill" : "ok-pill"}>{blocked ? "Revisa los colores" : "Todo legible"}</span>
            </div>
            <div>
              {checks.map((c) => (
                <div className="contrast" key={c.label}>
                  <span>{c.label}</span>
                  <span className="row g2"><span className="a-cap money">{c.ratio}</span><span className={c.ok ? "ok-pill" : "bad-pill"}>{c.ok ? "Se lee bien" : "No se lee"}</span></span>
                </div>
              ))}
            </div>
            {blocked && (
              <div className="a-banner err">
                <AIAlert size="sm" />
                <span>Esta combinación no se lee bien. Ajusta los colores marcados para poder publicar.</span>
              </div>
            )}
          </section>
        </div>

        <section className="a-card sticky-prev" aria-labelledby="ap-prev">
          <div className="a-card-h">
            <h2 className="a-h2" id="ap-prev">Vista previa</h2>
            <div className="a-seg" role="group" aria-label="Tamaño de la vista previa">
              <button className={mode === "m" ? "on" : ""} type="button" aria-pressed={mode === "m"} onClick={() => setMode("m")}>Móvil</button>
              <button className={mode === "d" ? "on" : ""} type="button" aria-pressed={mode === "d"} onClick={() => setMode("d")}>Desktop</button>
            </div>
          </div>
          <div className="prev-frame">
            <StorePreview bundle={texts.bundle} tokens={v} mode={mode} label={`Vista previa de la tienda con la paleta ${name}`} />
          </div>
          <p className="a-cap">Es la página de inicio real de tu tienda{texts.hasDraft ? ", con tus textos en borrador" : ""}.</p>
        </section>
      </div>

      <div className="a-sticky">
        <span className="a-cap">{footNote}</span>
        <div className="row g2">
          <button className="a-btn" type="button" disabled={!doc.dirty} onClick={() => { doc.saveDraft(); toast("Borrador guardado"); }}>Guardar borrador</button>
          <button
            className="a-btn primary"
            type="button"
            disabled={blocked || doc.status === "live"}
            onClick={() => { doc.publish(); setJustPublished(true); toast(`Paleta “${name}” publicada`); }}
          >
            Publicar
          </button>
        </div>
      </div>
    </AdminPage>
  );
}
