/** Utilidades de color para Admin › Apariencia (contraste WCAG y tonos derivados). */

export function normalizeHex(v: string): string | null {
  const m = v.trim().match(/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!m) return null;
  const x = m[1].length === 3 ? m[1].split("").map((c) => c + c).join("") : m[1];
  return `#${x.toUpperCase()}`;
}

function rgb(hex: string): [number, number, number] {
  const x = (normalizeHex(hex) ?? "#000000").slice(1);
  return [0, 2, 4].map((i) => parseInt(x.slice(i, i + 2), 16)) as [number, number, number];
}

function toHex(c: number[]): string {
  return `#${c.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("").toUpperCase()}`;
}

/** Mezcla a con b (t = proporción de b), igual que color-mix en sRGB. */
export function mix(a: string, b: string, t: number): string {
  const A = rgb(a);
  const B = rgb(b);
  return toHex(A.map((v, i) => v * (1 - t) + B[i] * t));
}

export function luminance(hex: string): number {
  return rgb(hex)
    .map((v) => {
      const c = v / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    })
    .reduce((s, v, i) => s + v * [0.2126, 0.7152, 0.0722][i], 0);
}

export function contrast(a: string, b: string): number {
  const x = luminance(a);
  const y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

/** El texto (claro u oscuro) que mejor se lee sobre un color. */
export function readableOn(bg: string, light = "#FFFFFF", dark = "#121016"): string {
  return contrast(light, bg) >= contrast(dark, bg) ? light : dark;
}

export const isDark = (hex: string) => luminance(hex) < 0.2;
