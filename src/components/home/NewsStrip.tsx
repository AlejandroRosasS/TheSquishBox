"use client";

import Link from "next/link";
import { useRef } from "react";
import type { Storefront } from "@/lib/types";
import { Photo } from "@/components/Photo";
import { Rich } from "@/components/Rich";
import { IconChevronLeft, IconChevronRight } from "@/components/Icons";

const isExternal = (href: string) => /^https?:\/\//.test(href);

/** Novedades de Inicio: tira horizontal tipo reel con las fotos del momento. */
export function NewsStrip({ news }: { news: Storefront["news"] }) {
  const track = useRef<HTMLUListElement>(null);
  const items = news.items.filter((n) => n.image);
  if (!news.showOnHome || !items.length) return null;
  const scroll = (dir: number) => {
    const el = track.current;
    if (!el) return;
    const card = el.querySelector("li");
    el.scrollBy({ left: dir * ((card?.clientWidth ?? 260) + 14) * 2, behavior: "smooth" });
  };

  return (
    <div className="news stack g5" role="region" data-edit="news" aria-labelledby="news-title">
      <div className="row between" style={{ alignItems: "flex-end", gap: 16 }}>
        <div className="stack g2">
          <p className="eyebrow">{news.eyebrow}</p>
          <h2 className="h2" id="news-title"><Rich text={news.title} /></h2>
        </div>
        {items.length > 2 && (
          <div className="row g2 only-d">
            <button className="news-nav" type="button" aria-label="Novedades anteriores" onClick={() => scroll(-1)}><IconChevronLeft size="sm" /></button>
            <button className="news-nav" type="button" aria-label="Más novedades" onClick={() => scroll(1)}><IconChevronRight size="sm" /></button>
          </div>
        )}
      </div>
      <ul className="news-track" ref={track}>
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
    </div>
  );
}
