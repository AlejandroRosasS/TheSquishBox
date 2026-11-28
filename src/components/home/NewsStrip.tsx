"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Storefront } from "@/lib/types";
import { Photo } from "@/components/Photo";
import { Rich } from "@/components/Rich";
import { IconChevronLeft, IconChevronRight } from "@/components/Icons";

const isExternal = (href: string) => /^https?:\/\//.test(href);
/** Cada cuánto avanza sola (ms). */
const EVERY = 4000;

/**
 * Novedades de Inicio: carrusel que avanza solo hacia la izquierda y da la vuelta.
 * Debajo: flecha ‹, puntitos (en cuál vas), flecha › y pausa/play. Se puede deslizar con el dedo.
 * Si todas entran en pantalla, no se mueve ni muestra controles.
 */
export function NewsStrip({ news }: { news: Storefront["news"] }) {
  const track = useRef<HTMLUListElement>(null);
  const items = news.items.filter((n) => n.image);
  /** Posiciones a las que se puede llegar (las últimas fotos ya se ven desde la anterior). */
  const [stops, setStops] = useState<number[]>([]);
  const [at, setAt] = useState(0);
  const [paused, setPaused] = useState(false);

  // Mide las posiciones de cada foto y cuáles se pueden alcanzar.
  useEffect(() => {
    const el = track.current;
    if (!el) return;
    const measure = () => {
      const max = el.scrollWidth - el.clientWidth;
      if (max < 4) return setStops([]);
      const lis = Array.from(el.children) as HTMLElement[];
      const base = lis[0]?.offsetLeft ?? 0;
      const pos = lis.map((li) => Math.min(li.offsetLeft - base, max));
      setStops(pos.filter((p, i) => i === 0 || p - pos[i - 1] > 4));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [items.length]);

  // Quien prefiere menos movimiento lo ve en pausa desde el inicio.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- preferencia del navegador, solo en el cliente
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) setPaused(true);
  }, []);

  const go = useCallback(
    (i: number) => {
      const el = track.current;
      if (!el || !stops.length) return;
      const n = (i + stops.length) % stops.length;
      el.scrollTo({ left: stops[n], behavior: "smooth" });
      setAt(n);
    },
    [stops],
  );

  // Avanza sola; al tocar una flecha o un puntito, el conteo vuelve a empezar (depende de `at`).
  useEffect(() => {
    if (paused || stops.length < 2) return;
    const t = window.setTimeout(() => go(at + 1), EVERY);
    return () => window.clearTimeout(t);
  }, [paused, stops, at, go]);

  // Si la desliza con el dedo, los puntitos siguen a la foto que quedó al inicio.
  const onScroll = () => {
    const el = track.current;
    if (!el || !stops.length) return;
    let best = 0;
    stops.forEach((s, i) => { if (Math.abs(s - el.scrollLeft) < Math.abs(stops[best] - el.scrollLeft)) best = i; });
    if (best !== at) setAt(best);
  };

  if (!news.showOnHome || !items.length) return null;
  const moving = stops.length > 1;

  return (
    // Va primero, justo debajo de la portada: lo más fresco de la marca.
    <section className="section tight news-sec" data-edit="news" aria-labelledby="news-title" aria-roledescription="carrusel">
    <div className="wrap news stack g5">
      <div className="stack g2 news-head">
        <p className="eyebrow">{news.eyebrow}</p>
        <h2 className="h2" id="news-title"><Rich text={news.title} /></h2>
      </div>
      <ul className="news-track" ref={track} onScroll={onScroll} aria-live={paused ? "polite" : "off"}>
        {items.map((n) => {
          const body = (
            <>
              <div className="ph r45">
                <Photo src={n.image} alt={n.alt} slot="4:5" loading="lazy" />
                {n.reel && <span className="news-reel"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z" /></svg><span className="visually-hidden">Reel</span></span>}
              </div>
              {n.caption && <p className="news-cap">{n.caption}</p>}
            </>
          );
          return (
            <li key={n.id}>
              {!n.href ? <div className="news-card">{body}</div> : isExternal(n.href) ? (
                <a className="news-card" href={n.href} target="_blank" rel="noreferrer">{body}</a>
              ) : (
                <Link className="news-card" href={n.href}>{body}</Link>
              )}
            </li>
          );
        })}
      </ul>
      {moving && (
        <div className="news-ctrl">
          <button className="news-nav" type="button" aria-label="Novedad anterior" onClick={() => go(at - 1)}><IconChevronLeft size="sm" /></button>
          <div className={`news-dots${stops.length > 8 ? " many" : ""}`} role="group" aria-label="Elegir novedad">
            {stops.map((_, i) => (
              <button key={i} type="button" className={`news-dot${i === at ? " on" : ""}`} aria-label={`Ir a la novedad ${i + 1} de ${stops.length}`} aria-current={i === at ? "true" : undefined} onClick={() => go(i)}><span /></button>
            ))}
          </div>
          <button className="news-nav" type="button" aria-label="Siguiente novedad" onClick={() => go(at + 1)}><IconChevronRight size="sm" /></button>
          <button className={`news-pause${paused ? " paused" : ""}`} type="button" aria-label={paused ? "Reanudar novedades" : "Pausar novedades"} onClick={() => setPaused(!paused)}>
            <span>
              {paused ? (
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z" /></svg>
              ) : (
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" /></svg>
              )}
            </span>
          </button>
        </div>
      )}
    </div>
    </section>
  );
}
