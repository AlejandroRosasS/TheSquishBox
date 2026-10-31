"use client";

import { useState } from "react";
import { useStore } from "./StoreContext";
import { paletteVars } from "@/lib/theme";

/** Solo para la demo de Fase 1: probar las paletas del tenant. En Fase 2 esto vive en Admin › Apariencia. */
export function PaletteDemo() {
  const { tenant } = useStore();
  const [key, setKey] = useState(tenant.defaultPalette);
  const apply = (k: string) => {
    setKey(k);
    const el = document.querySelector<HTMLElement>(".store");
    if (!el) return;
    for (const [name, val] of Object.entries(paletteVars(tenant.palettes[k]))) el.style.setProperty(name, val);
  };
  return (
    <label className="palette-demo">
      <span>Paleta (demo)</span>
      <select value={key} onChange={(e) => apply(e.target.value)}>
        {Object.entries(tenant.palettes).map(([k, p]) => (
          <option key={k} value={k}>{p.name}</option>
        ))}
      </select>
    </label>
  );
}
