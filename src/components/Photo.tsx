"use client";

/* eslint-disable @next/next/no-img-element */
import { createContext, useContext, useMemo, type CSSProperties, type ReactNode } from "react";
import { asset } from "@/lib/assets";
import { frameOf, frameStyle, frameVars, type FormatId, type MediaMap, type Slot } from "@/lib/media";

type MediaCtx = {
  /** src guardado → URL que puede mostrar el navegador (o undefined si aún no está lista). */
  resolve: (src: string) => string | undefined;
  media: MediaMap;
  /** "auto" = según el ancho de la pantalla. "m"/"d" fuerzan un formato (vistas previas del admin). */
  mode: "auto" | "m" | "d";
};

const Ctx = createContext<MediaCtx>({ resolve: (s) => s, media: {}, mode: "auto" });

export function MediaProvider({ slug, media, resolve, mode, children }: { slug?: string; media?: MediaMap; resolve?: (src: string) => string | undefined; mode?: MediaCtx["mode"]; children: ReactNode }) {
  const parent = useContext(Ctx);
  const value = useMemo<MediaCtx>(
    () => ({
      resolve: resolve ?? (slug ? (s) => asset(slug, s) : parent.resolve),
      media: media ?? parent.media,
      mode: mode ?? parent.mode,
    }),
    [parent, slug, media, resolve, mode],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useMedia = () => useContext(Ctx);

type Props = {
  src: string;
  alt: string;
  /** Formatos donde se muestra: uno solo, o uno para escritorio y otro para celular. */
  slot: Slot | FormatId;
  /** Foto distinta para celular (si no hay, se usa la misma con su encuadre de celular). */
  srcMobile?: string;
  loading?: "lazy" | "eager";
  fetchPriority?: "high" | "low" | "auto";
  className?: string;
  style?: CSSProperties;
};

/**
 * Foto de la tienda con encuadre por formato. Va dentro de un contenedor con overflow: hidden
 * (.ph, .hero, .tile…) y se recorta con object-fit: cover.
 */
export function Photo({ src, alt, slot, srcMobile, loading, fetchPriority, className, style }: Props) {
  const { resolve, media, mode } = useMedia();
  const s = typeof slot === "string" ? { d: slot, m: slot } : slot;
  const mSrc = srcMobile || src;
  const dUrl = resolve(src);
  const mUrl = resolve(mSrc);
  const fD = frameOf(media, src, s.d);
  const fM = frameOf(media, mSrc, s.m);

  if (mode !== "auto") {
    const url = mode === "m" ? mUrl : dUrl;
    const f = mode === "m" ? fM : fD;
    if (!url) return <span className={className} aria-label={alt} role="img" />;
    return <img src={url} alt={alt} loading={loading} fetchPriority={fetchPriority} className={className} style={{ ...frameStyle(f), ...style }} />;
  }

  if (!dUrl) return <span className={className} aria-label={alt} role="img" />;
  const img = (
    <img
      src={dUrl}
      alt={alt}
      loading={loading}
      fetchPriority={fetchPriority}
      className={["fr", className].filter(Boolean).join(" ")}
      style={{ ...frameVars(fD, fM), ...style } as CSSProperties}
    />
  );
  if (mSrc === src || !mUrl) return img;
  // Foto distinta en celular: el navegador descarga solo la que corresponde.
  return (
    <picture style={{ display: "contents" }}>
      <source media="(max-width: 760px)" srcSet={mUrl} />
      {img}
    </picture>
  );
}
