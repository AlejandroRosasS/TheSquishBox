"use client";

import { useState } from "react";
import { Logo } from "@/components/Logo";
import { withBrand, type Brand } from "@/lib/brand";
import { useAdmin } from "../AdminContext";
import { useAdminMedia } from "../AdminMedia";
import { ColorField } from "../ColorField";
import { PhotoPicker } from "../PhotoPicker";

/** Nombre, subtítulo del panel y logo de la marca (parte del documento de Apariencia). */
export function BrandCard({ value, onChange }: { value: Brand; onChange: (b: Brand) => void }) {
  const { bundle } = useAdmin();
  const { resolve } = useAdminMedia();
  const [picking, setPicking] = useState(false);
  const hasLetters = !!bundle.tenant.logo.lines?.length;
  const shown = withBrand(bundle.tenant, value);
  const setLogo = (patch: Partial<Brand["logo"]>) => onChange({ ...value, logo: { ...value.logo, ...patch } });
  const noName = !value.name.trim();
  const ink = bundle.storefront.brand.ink;
  const footerBg = bundle.tenant.brandColors[ink] ?? ink;

  return (
    <section className="a-card" aria-labelledby="ap-brand">
      <h2 className="a-h2" id="ap-brand">Nombre y logo</h2>
      <div className="brand-cols">
        <div className="stack g4">
          <div className="a-field">
            <label htmlFor="br-name">Nombre de la marca</label>
            <input id="br-name" className="a-input" value={value.name} aria-invalid={noName || undefined} aria-describedby="br-name-h" onChange={(e) => onChange({ ...value, name: e.target.value })} />
            <p className="a-cap" id="br-name-h">{noName ? "Escribe el nombre para poder publicar." : "Se usa en la tienda, el título de las páginas, los textos legales y este panel."}</p>
          </div>
          <div className="a-field">
            <label htmlFor="br-sub">Subtítulo en el panel</label>
            <input id="br-sub" className="a-input" value={value.subtitle} aria-describedby="br-sub-h" onChange={(e) => onChange({ ...value, subtitle: e.target.value })} />
            <p className="a-cap" id="br-sub-h">Solo lo ve tu equipo, debajo del nombre en el menú.</p>
          </div>

          <fieldset className="stack g3" style={{ border: 0, padding: 0, margin: 0 }}>
            <legend className="a-label" style={{ marginBottom: 8 }}>Logo</legend>
            {hasLetters && (
              <div className="a-seg" role="radiogroup" aria-label="Tipo de logo" style={{ alignSelf: "flex-start" }}>
                {([["image", "Imagen"], ["css", "Con letras"]] as const).map(([k, l]) => (
                  <button key={k} type="button" role="radio" aria-checked={value.logo.type === k} className={value.logo.type === k ? "on" : ""} onClick={() => setLogo({ type: k })}>{l}</button>
                ))}
              </div>
            )}
            {value.logo.type === "image" ? (
              <div className="stack g2">
                <button className="a-btn" type="button" style={{ alignSelf: "flex-start" }} onClick={() => setPicking(true)}>{value.logo.image ? "Cambiar imagen" : "Elegir imagen"}</button>
                <p className="a-cap">Se muestra con su forma: redonda, cuadrada o alargada, sin recortarla. Usa un PNG con fondo transparente o un JPG con su propio fondo, de al menos 400 px de alto.</p>
              </div>
            ) : (
              <ColorField id="br-bg" label="Fondo del logo" hint="círculo detrás de las letras" value={value.logo.background ?? "#141018"} onChange={(hex) => setLogo({ background: hex })} />
            )}
          </fieldset>
        </div>

        <div className="stack g3" aria-label="Así se ve">
          <p className="a-label">Así se ve</p>
          <div className="brand-prev">
            <span className="a-cap">Menú del panel</span>
            <div className="a-brand" style={{ padding: 0 }}>
              <Logo tenant={shown} size="sm" resolve={resolve} />
              <div className="a-brand-txt">
                <b>{shown.name}</b>
                <p className="a-cap">{value.subtitle}</p>
              </div>
            </div>
          </div>
          <div className="brand-prev store-tone">
            <span className="a-cap">Cabecera de la tienda</span>
            <Logo tenant={shown} resolve={resolve} />
          </div>
          <div className="brand-prev" style={{ background: footerBg, color: "#fff" }}>
            <span className="a-cap" style={{ color: "inherit", opacity: 0.8 }}>Pie de la tienda</span>
            <Logo tenant={shown} size="lg" resolve={resolve} />
          </div>
        </div>
      </div>

      <PhotoPicker
        open={picking}
        title="Logo de la marca"
        hint="Elige una imagen o sube una nueva. Se verá completa, con su forma."
        onPick={(src) => { setLogo({ type: "image", image: src }); setPicking(false); }}
        onClose={() => setPicking(false)}
      />
    </section>
  );
}
