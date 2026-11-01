/**
 * Tema publicado desde Admin › Apariencia (demo de Fase 2, guardado en el navegador).
 * Se aplica con una hoja <style id="published-theme"> que pisa los tokens de la marca.
 * En Fase 3 los tokens publicados vendrán de la base de datos y se inyectarán en el servidor.
 */
export const TOKEN_VARS = {
  bg: "--bg",
  surface: "--surface",
  primary: "--primary",
  onPrimary: "--on-primary",
  accent: "--accent",
  text: "--text",
  text2: "--text-2",
  border: "--border",
} as const;

export type TokenKey = keyof typeof TOKEN_VARS;
export type Tokens = Record<TokenKey, string>;
export const TOKEN_KEYS = Object.keys(TOKEN_VARS) as TokenKey[];

/** Código que corre antes de pintar la tienda (sin dependencias, va como string en un <script>). */
export function themeBootScript(slug: string): string {
  const map = JSON.stringify(TOKEN_VARS);
  return `(function(){try{var d=JSON.parse(localStorage.getItem(${JSON.stringify(`site:${slug}:appearance`)})||"null");var t=d&&d.published&&d.published.tokens;var m=${map};var css="";if(t){for(var k in m){if(/^#[0-9A-Fa-f]{6}$/.test(t[k]||""))css+=m[k]+":"+t[k]+" !important;";}}var s=document.getElementById("published-theme");if(!css){if(s)s.remove();return;}if(!s){s=document.createElement("style");s.id="published-theme";document.head.appendChild(s);}s.textContent=".store:not(.store-preview){"+css+"}";}catch(e){}})();`;
}

/** Misma lógica que themeBootScript, para usar desde React. */
export function applyPublishedTheme(slug: string, tokens?: Partial<Tokens> | null) {
  let t = tokens;
  if (t === undefined) {
    try {
      t = (JSON.parse(localStorage.getItem(`site:${slug}:appearance`) || "null") as { published?: { tokens?: Tokens } } | null)?.published?.tokens;
    } catch {
      t = null;
    }
  }
  const css = t
    ? TOKEN_KEYS.filter((k) => /^#[0-9A-Fa-f]{6}$/.test(t?.[k] ?? "")).map((k) => `${TOKEN_VARS[k]}:${t?.[k]} !important;`).join("")
    : "";
  let s = document.getElementById("published-theme");
  if (!css) {
    s?.remove();
    return;
  }
  if (!s) {
    s = document.createElement("style");
    s.id = "published-theme";
    document.head.appendChild(s);
  }
  s.textContent = `.store:not(.store-preview){${css}}`;
}
