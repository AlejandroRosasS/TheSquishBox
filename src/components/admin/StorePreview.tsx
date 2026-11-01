"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type CSSProperties, type ReactNode } from "react";
import type { TenantBundle } from "@/tenants";
import { StoreProvider } from "@/components/StoreContext";
import { CartProvider } from "@/components/cart/CartProvider";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { HomeView } from "@/components/home/HomeView";
import { storeStyle, paletteVars } from "@/lib/theme";
import type { Tokens } from "@/lib/publishedTheme";

type Props = {
  bundle: TenantBundle;
  tokens?: Tokens;
  mode: "m" | "d";
  /** Alto visible del marco (px). El resto se ve con scroll. */
  maxHeight?: number;
  label?: string;
  /** Página a mostrar; por defecto la Home. */
  children?: ReactNode;
};

const WIDTH = { m: 390, d: 1280 };
const noop = () => () => {};

/**
 * La Home real de la tienda, renderizada con la paleta y los textos que se están editando.
 * Se dibuja a su ancho real (celular o desktop) y se escala para caber en el panel.
 * Es solo para mirar: no se puede navegar ni enfocar (inert).
 */
export function StorePreview({ bundle, tokens, mode, maxHeight = 680, label = "Vista previa de la tienda", children }: Props) {
  const outer = useRef<HTMLDivElement>(null);
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
  const style = {
    ...storeStyle(bundle.tenant, bundle.storefront),
    ...(tokens ? paletteVars({ ...tokens, name: "" }) : {}),
  } as CSSProperties;

  return (
    <div style={{ maxHeight, overflowY: "auto", width: "100%", borderRadius: 10 }} role="region" aria-label={label} tabIndex={0}>
      <div ref={outer} className={`prev-scale ${mode === "m" ? "m" : ""}`} style={{ height: box.h * scale || 400, margin: "0 auto" }}>
        <div ref={inner} className="prev-inner" style={{ width, transform: `scale(${scale})`, visibility: scale ? "visible" : "hidden" }} inert>
          {bundle.tenant.fonts.googleFontsUrl && <link rel="stylesheet" href={bundle.tenant.fonts.googleFontsUrl} precedence="default" />}
          {mounted && (
            <div className="store store-preview" style={style}>
              <StoreProvider value={bundle}>
                <CartProvider>
                  <Header />
                  {children ?? <HomeView bundle={bundle} />}
                  <Footer bundle={bundle} year={new Date().getFullYear()} />
                </CartProvider>
              </StoreProvider>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
