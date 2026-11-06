"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type CSSProperties, type ReactNode } from "react";
import type { TenantBundle } from "@/tenants";
import { StoreProvider } from "@/components/StoreContext";
import { MediaProvider } from "@/components/Photo";
import { CartProvider, type CartItem } from "@/components/cart/CartProvider";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { HomeView } from "@/components/home/HomeView";
import { storeStyle, paletteVars } from "@/lib/theme";
import type { Tokens } from "@/lib/publishedTheme";
import { findTarget, type PreviewFocus } from "./previewFocus";

type Props = {
  bundle: TenantBundle;
  tokens?: Tokens;
  mode: "m" | "d";
  /** Alto visible del marco (px). El resto se ve con scroll. */
  maxHeight?: number;
  label?: string;
  /** Página a mostrar; por defecto la Home. */
  children?: ReactNode;
  /** false = sin cabecera ni pie (checkout, confirmación). */
  chrome?: boolean;
  /** Carrito de ejemplo (si no, el del navegador). */
  cart?: CartItem[];
  /** Campo que se está editando: se resalta y el scroll lo sigue. */
  focus?: PreviewFocus;
};

type Hl = { top: number; left: number; w: number; h: number };

const WIDTH = { m: 390, d: 1280 };
const noop = () => () => {};

/**
 * La Home real de la tienda, renderizada con la paleta y los textos que se están editando.
 * Se dibuja a su ancho real (celular o desktop) y se escala para caber en el panel.
 * Es solo para mirar: no se puede navegar ni enfocar (inert).
 */
export function StorePreview({ bundle, tokens, mode, maxHeight = 680, label = "Vista previa de la tienda", children, chrome = true, cart, focus }: Props) {
  const scroller = useRef<HTMLDivElement>(null);
  const outer = useRef<HTMLDivElement>(null);
  const [hl, setHl] = useState<Hl | null>(null);
  const scrolledFor = useRef<string | null>(null);
  const inner = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });
  // Solo se dibuja en el navegador (mide el ancho disponible y usa la fecha local).
  const mounted = useSyncExternalStore(noop, () => true, () => false);
  const width = WIDTH[mode];

  useEffect(() => {
    if (!mounted) return;
    const o = outer.current;
    const i = inner.current;
    if (!o || !i) return;
    const ro = new ResizeObserver(() => setBox({ w: o.clientWidth, h: i.offsetHeight }));
    ro.observe(o);
    ro.observe(i);
    return () => ro.disconnect();
  }, [mounted]);

  const scale = box.w ? Math.min(1, box.w / width) : 0;

  // Resaltar el campo que se edita y llevar el scroll hasta él (solo cuando cambia el campo).
  const fId = focus?.id;
  const fScope = focus?.scope?.join("|");
  const fKey = focus?.key;
  const fValue = focus?.value;
  useEffect(() => {
    if (!mounted || !focus) return;
    const raf = requestAnimationFrame(() => {
      const o = outer.current;
      const i = inner.current;
      const sc = scroller.current;
      if (!o || !i || !sc) return;
      const el = findTarget(i, focus);
      if (!el) {
        setHl(null);
        if (scrolledFor.current !== focus.id) { sc.scrollTo({ top: 0 }); scrolledFor.current = focus.id; }
        return;
      }
      const r = el.getBoundingClientRect();
      const or = o.getBoundingClientRect();
      // Un poco de aire alrededor para que el borde no tape el texto.
      const next = { top: r.top - or.top - 4, left: r.left - or.left - 4, w: r.width + 8, h: r.height + 8 };
      setHl((prev) => (prev && Math.abs(prev.top - next.top) + Math.abs(prev.left - next.left) + Math.abs(prev.w - next.w) + Math.abs(prev.h - next.h) < 1 ? prev : next));
      if (scrolledFor.current !== focus.id) {
        scrolledFor.current = focus.id;
        const sr = sc.getBoundingClientRect();
        const top = r.top - sr.top + sc.scrollTop;
        const room = sc.clientHeight;
        const target = r.height > room - 40 ? top - 20 : top - (room - r.height) / 2;
        sc.scrollTo({ top: Math.max(0, target), behavior: "smooth" });
      }
    });
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `focus` se compara por sus campos
  }, [mounted, fId, fScope, fKey, fValue, box.w, box.h, scale, children, bundle]);
  const style = {
    ...storeStyle(bundle.tenant, bundle.storefront),
    ...(tokens ? paletteVars({ ...tokens, name: "" }) : {}),
  } as CSSProperties;

  return (
    <div ref={scroller} style={{ maxHeight, overflowY: "auto", width: "100%", borderRadius: 10 }} role="region" aria-label={label} tabIndex={0}>
      <div ref={outer} className={`prev-scale ${mode === "m" ? "m" : ""}`} style={{ height: box.h * scale || 400, margin: "0 auto" }}>
        <div ref={inner} className="prev-inner" style={{ width, transform: `scale(${scale})`, visibility: scale ? "visible" : "hidden" }} inert>
          {bundle.tenant.fonts.googleFontsUrl && <link rel="stylesheet" href={bundle.tenant.fonts.googleFontsUrl} precedence="default" />}
          {mounted && (
            <div className="store store-preview" style={style}>
              <StoreProvider value={bundle}>
              <MediaProvider mode={mode}>
                <CartProvider key={cart ? JSON.stringify(cart) : "browser"} demo={cart}>
                  {chrome && <Header />}
                  <main>{children ?? <HomeView bundle={bundle} />}</main>
                  {chrome && <Footer bundle={bundle} year={new Date().getFullYear()} />}
                </CartProvider>
              </MediaProvider>
              </StoreProvider>
            </div>
          )}
        </div>
        {focus && hl && (
          <div className={`prev-hl${hl.top < 24 ? " below" : ""}${hl.left > box.w * scale * 0.45 ? " right" : ""}`} style={{ top: hl.top, left: hl.left, width: hl.w, height: hl.h }} aria-hidden="true">
            {focus.label && <span>{focus.label}</span>}
          </div>
        )}
      </div>
    </div>
  );
}
