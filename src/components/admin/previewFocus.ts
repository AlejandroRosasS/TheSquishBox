/**
 * Encuentra en la vista previa de la tienda el elemento que muestra el campo que se está editando
 * (Admin › Textos), para resaltarlo y llevar el scroll hasta él.
 */
export type PreviewFocus = {
  /** Cambia cuando cambia la sección o el campo con foco: solo entonces se mueve el scroll. */
  id: string;
  /** Dónde buscar (selectores CSS, en orden). Si no hay campo, se resalta el primero (salvo "main"). */
  scope?: string[];
  /** Clave del campo (href, image, title…) y su valor actual. */
  key?: string;
  value?: unknown;
  /** Texto de la etiqueta «Editando: …». */
  label?: string;
};

const visible = (el: Element) => el.getClientRects().length > 0;
const norm = (s: string | null) => (s ?? "").replace(/\s+/g, " ");

/** Texto tal como se ve en la tienda: sin *marcas*, [enlaces](/ruta) ni {variables}. */
function needle(v: string): string | null {
  const chunks = v
    .split(/\{\w+\}|\n/)
    .map((c) => c.replace(/\[([^\]]*)\]\([^)]*\)/g, "$1").replace(/\*+/g, "").replace(/\s+/g, " ").trim())
    .filter((c) => c.length >= 2);
  if (!chunks.length) return null;
  const best = chunks.sort((a, b) => b.length - a.length)[0];
  return best.slice(0, 60).trim();
}

/** El elemento visible más interno que contiene el texto. */
function findText(root: Element, n: string): Element | null {
  if (!visible(root) || !norm(root.textContent).includes(n)) return null;
  let cur = root;
  for (;;) {
    const next = [...cur.children].find((c) => visible(c) && norm(c.textContent).includes(n));
    if (!next) return cur;
    cur = next;
  }
}

export function findTarget(root: HTMLElement, f: PreviewFocus): Element | null {
  const scopes = (f.scope ?? []).flatMap((s) => [...root.querySelectorAll(s)]).filter(visible);
  const areas = scopes.length ? scopes : [root];
  const v = f.value;
  if (typeof v === "string" && v.trim()) {
    for (const a of areas) {
      let el: Element | null | undefined = null;
      if (f.key === "href") {
        el = [...a.querySelectorAll("a[href]")].find((x) => x.getAttribute("href") === v && visible(x));
      } else if (f.key === "image" || f.key === "imageMobile") {
        const file = v.split("/").pop() ?? v;
        const img = [...a.querySelectorAll("img")].find((i) => visible(i) && (i.getAttribute("src") ?? "").includes(file));
        el = img?.closest(".ph, .hero, .tile") ?? img;
      } else {
        const n = needle(v);
        if (n) el = findText(a, n);
      }
      if (el) return el;
    }
  }
  if (f.scope?.[0] === "main") return null;
  return scopes[0] ?? null;
}
