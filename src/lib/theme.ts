import type { CSSProperties } from "react";
import type { PaletteTokens, Storefront, Tenant } from "./types";
import type { Tokens } from "./publishedTheme";

export function paletteVars(p: PaletteTokens): Record<string, string> {
  return {
    "--bg": p.bg,
    "--surface": p.surface,
    "--primary": p.primary,
    "--on-primary": p.onPrimary,
    "--accent": p.accent,
    "--text": p.text,
    "--text-2": p.text2,
    "--border": p.border,
  };
}

/** Variables CSS de la marca: 8 tokens de la paleta activa + colores fijos de marca + fuentes. */
export function storeStyle(tenant: Tenant, sf: Storefront, paletteKey?: string, tokens?: Tokens | null): CSSProperties {
  const base = tenant.palettes[paletteKey ?? tenant.defaultPalette] ?? Object.values(tenant.palettes)[0];
  const palette = tokens ? { ...base, ...tokens } : base;
  const color = (v: string) => tenant.brandColors[v] ?? v;
  const vars: Record<string, string> = {
    ...paletteVars(palette),
    "--brand-ink": color(sf.brand.ink),
    "--brand-emphasis": color(sf.brand.emphasis),
    "--font-display": `'${tenant.fonts.display}'`,
    "--font-body": `'${tenant.fonts.body}'`,
  };
  if (tenant.logo.background) vars["--logo-bg"] = tenant.logo.background;
  sf.brand.highlights.slice(0, 4).forEach((h, i) => {
    vars[`--hl-${i + 1}`] = color(h.bg);
    vars[`--hl-${i + 1}-fg`] = color(h.fg);
  });
  return vars as CSSProperties;
}
