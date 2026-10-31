"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import type { Product } from "@/lib/types";
import { useStore } from "@/components/StoreContext";
import { useCart } from "@/components/cart/CartProvider";
import { Rich } from "@/components/Rich";
import { asset } from "@/lib/assets";
import { formatPrice } from "@/lib/format";
import { isSoldOut, LOW_STOCK, variantStockLabel } from "@/lib/catalog";
import { IconInstagram, IconMinus, IconPlus, IconTruck } from "@/components/Icons";

/* eslint-disable @next/next/no-img-element */

export function ProductView({ product: p, lineLabel }: { product: Product; lineLabel: string }) {
  const { tenant, catalog, storefront: sf } = useStore();
  const cart = useCart();
  const cur = tenant.currency;
  const allOut = isSoldOut(p);
  const firstAvailable = p.variants.find((v) => v.stock > 0) ?? p.variants[0];
  const [vid, setVid] = useState(firstAvailable.id);
  const [img, setImg] = useState(0);
  const [qty, setQty] = useState(1);
  const [notify, setNotify] = useState<"idle" | "error" | "done">("idle");
  const [email, setEmail] = useState("");
  const slider = useRef<HTMLDivElement>(null);

  const v = p.variants.find((x) => x.id === vid) ?? firstAvailable;
  const curOut = allOut || v.stock <= 0;
  const stockBadge = curOut ? "Agotado" : v.stock <= LOW_STOCK ? `Últimas ${v.stock}` : "";
  const images = p.images.map((src) => asset(tenant.slug, src));
  const ig = `https://www.instagram.com/${tenant.instagram}/`;

  const pickVariant = (id: string) => {
    setVid(id);
    setQty(1);
  };

  const goTo = (i: number) => {
    setImg(i);
    const el = slider.current;
    if (el) el.scrollTo({ left: el.clientWidth * i, behavior: "smooth" });
  };

  const add = () => cart.add(p.id, v.id, qty);

  const submitNotify = (e: React.FormEvent) => {
    e.preventDefault();
    setNotify(/^\S+@\S+\.\S+$/.test(email) ? "done" : "error");
  };

  return (
    <>
      <div className="pdp" style={{ paddingBottom: 80 }}>
        <div className="stack g3">
          <div className="gallery only-d">
            <div className="gthumbs">
              {images.map((src, i) => (
                <button key={src} className={`gthumb ${img === i ? "on" : ""}`} type="button" aria-label={`Ver foto ${i + 1}`} aria-pressed={img === i} onClick={() => setImg(i)}>
                  <img src={src} alt="" />
                </button>
              ))}
            </div>
            <div className={`ph r45 ${allOut ? "dim" : ""}`} style={{ borderRadius: 24 }}>
              <img src={images[img]} alt={`${p.name}, foto ${img + 1}`} />
              {allOut && <span className="tag badge sold">Agotado</span>}
            </div>
          </div>

          <div className="only-m">
            <div
              className="gmain-m"
              ref={slider}
              onScroll={(e) => {
                const el = e.currentTarget;
                const i = Math.round(el.scrollLeft / el.clientWidth);
                if (i !== img) setImg(i);
              }}
            >
              {images.map((src, i) => (
                <div key={src} className={`ph r45 ${allOut ? "dim" : ""}`}>
                  <img src={src} alt={`${p.name}, foto ${i + 1}`} />
                  {allOut && i === 0 && <span className="tag badge sold">Agotado</span>}
                </div>
              ))}
            </div>
            {images.length > 1 && (
              <div className="dots-hit" style={{ marginTop: 12 }}>
                {images.map((src, i) => (
                  <span className="dots" key={src}>
                    <button type="button" className={img === i ? "on" : ""} aria-label={`Ver foto ${i + 1}`} onClick={() => goTo(i)} />
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="stack g5">
          <div className="stack g2">
            <p className="eyebrow">Línea {lineLabel}</p>
            <h1 className="h1">{p.name}</h1>
            <div className="row g3" style={{ marginTop: 6 }}>
              <span className="price-lg">{formatPrice(v.price, cur)}</span>
              {stockBadge && (
                <span className={`badge ${curOut ? "sold" : "low"}`}>
                  <span className="dot" />
                  {stockBadge}
                </span>
              )}
            </div>
          </div>

          {p.variants.length > 1 && (
            <div className="stack g3">
              <span className="label" id="variant-q">{sf.product.variantQuestion}</span>
              <div className="seg" role="radiogroup" aria-labelledby="variant-q">
                {p.variants.map((x) => {
                  const out = x.stock <= 0;
                  const s = variantStockLabel(x);
                  return (
                    <button
                      key={x.id}
                      className={`seg-opt ${x.id === v.id ? "on" : ""} ${out ? "off" : ""}`}
                      type="button"
                      role="radio"
                      aria-checked={x.id === v.id}
                      onClick={() => pickVariant(x.id)}
                    >
                      <span className="t">{x.label}</span>
                      <span className="p">{formatPrice(x.price, cur)}{s ? ` · ${s}` : ""}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {!curOut ? (
            <div className="stack g3">
              <div className="row g3">
                <div className="qty">
                  <button type="button" aria-label="Quitar uno" onClick={() => setQty(Math.max(1, qty - 1))} disabled={qty <= 1}>
                    <IconMinus size="sm" />
                  </button>
                  <span aria-live="polite">{qty}</span>
                  <button type="button" aria-label="Agregar uno" onClick={() => setQty(Math.min(v.stock, qty + 1))} disabled={qty >= v.stock}>
                    <IconPlus size="sm" />
                  </button>
                </div>
                <button className="btn grow" type="button" onClick={add}>
                  Agregar al carrito · {formatPrice(v.price * qty, cur)}
                </button>
              </div>
              {tenant.customOrder.enabled && (
                <p className="small muted"><Rich text={sf.product.partyHint} /></p>
              )}
            </div>
          ) : (
            <form className="stack g3" onSubmit={submitNotify} style={{ padding: 20, border: "1px solid var(--border)", borderRadius: 24, background: "var(--surface)" }}>
              <p className="h4">{allOut ? `${p.name} está agotado` : `${v.label} está agotado`}</p>
              <p className="small muted">{allOut ? sf.product.soldOutAllText : sf.product.soldOutVariantText}</p>
              {notify === "done" ? (
                <p className="note" role="status">Listo. Te escribiremos a <b>{email}</b> cuando vuelva.</p>
              ) : (
                <>
                  <div className={`field ${notify === "error" ? "error" : ""}`}>
                    <label htmlFor="notify-mail">Correo</label>
                    <input id="notify-mail" className="input" type="email" placeholder="tucorreo@ejemplo.com" value={email} onChange={(e) => setEmail(e.target.value)} aria-invalid={notify === "error"} />
                    {notify === "error" && <p className="err-msg">Escribe un correo válido.</p>}
                  </div>
                  <div className="row g3 wrap-row">
                    <button className="btn ghost grow" type="submit">Avísame cuando vuelva</button>
                    {allOut && tenant.customOrder.enabled && (
                      <Link className="btn grow" href="/fiesta">Pídela {tenant.customOrder.label.toLowerCase()}</Link>
                    )}
                  </div>
                </>
              )}
            </form>
          )}

          <div className="note">
            <IconTruck size="sm" />
            <span><Rich text={sf.product.deliveryNote} /></span>
          </div>

          <div className="info-list">
            <div className="info-item">
              <h3>Descripción</h3>
              <p className="body muted">{p.description}</p>
            </div>
            {catalog.tips && catalog.tips.length > 0 && (
              <div className="info-item">
                <h3>{sf.product.tipsTitle}</h3>
                <p className="body muted">{catalog.tips.join(" ")}</p>
              </div>
            )}
          </div>
          <a className="textlink" href={ig} target="_blank" rel="noreferrer">
            <IconInstagram size="sm" />
            Ver en Instagram
          </a>
        </div>
      </div>

      {!curOut && (
        <div className="sticky-buy only-m flex">
          <div className="stack" style={{ lineHeight: 1.2 }}>
            <span className="small muted">{v.label}</span>
            <span className="price">{formatPrice(v.price * qty, cur)}</span>
          </div>
          <button className="btn grow" type="button" onClick={add}>Agregar al carrito</button>
        </div>
      )}
      {!curOut && <div className="sticky-spacer" aria-hidden="true" />}
    </>
  );
}
