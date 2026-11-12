"use client";

import { customOrderHref, isContactForm } from "@/lib/customOrder";
import Link from "next/link";
import { useRef, useState } from "react";
import type { Product } from "@/lib/types";
import { useStore } from "@/components/StoreContext";
import { useCart } from "@/components/cart/CartProvider";
import { Rich } from "@/components/Rich";
import { Photo } from "@/components/Photo";
import { SLOTS } from "@/lib/media";
import { formatPrice } from "@/lib/format";
import { campaignDate } from "@/lib/campaigns";
import { hasOptions, isSoldOut, LOW_STOCK, minQty, unitsLeft, variantStockLabel } from "@/lib/catalog";
import { IconInstagram, IconMinus, IconPlus, IconTruck } from "@/components/Icons";

export function ProductView({ product: p, lineLabel }: { product: Product; lineLabel: string }) {
  const { tenant, catalog, storefront: sf } = useStore();
  const cart = useCart();
  const cur = tenant.currency;
  const min = minQty(p);
  // Con pedido mínimo, una opción con menos unidades que el mínimo no se puede pedir.
  const allOut = isSoldOut(p) || p.variants.every((v) => unitsLeft(p, v) < min);
  const firstAvailable = p.variants.find((v) => unitsLeft(p, v) >= min) ?? p.variants[0];
  const [vid, setVid] = useState(firstAvailable.id);
  const [img, setImg] = useState(0);
  const [qty, setQty] = useState(min);
  const [notify, setNotify] = useState<"idle" | "error" | "done">("idle");
  const [email, setEmail] = useState("");
  const slider = useRef<HTMLDivElement>(null);

  const v = p.variants.find((x) => x.id === vid) ?? firstAvailable;
  const left = unitsLeft(p, v);
  const curOut = allOut || left < min;
  const stockBadge = curOut ? "Agotado" : left <= LOW_STOCK ? `Últimas ${left}` : "";
  const images = p.images;
  const ig = `https://www.instagram.com/${tenant.instagram}/`;

  const options = hasOptions(p);

  const goTo = (i: number) => {
    setImg(i);
    const el = slider.current;
    if (el) el.scrollTo({ left: el.clientWidth * i, behavior: "smooth" });
  };

  const pickVariant = (id: string) => {
    setVid(id);
    setQty(min);
    // Si la opción tiene su propia foto, la galería salta a ella.
    const next = p.variants.find((x) => x.id === id);
    const i = next?.image ? p.images.indexOf(next.image) : -1;
    if (i >= 0) goTo(i);
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
                  <Photo src={src} alt="" slot={SLOTS.product} />
                </button>
              ))}
            </div>
            <div className={`ph r45 ${allOut ? "dim" : ""}`} style={{ borderRadius: 24 }}>
              <Photo src={images[img]} alt={`${p.name}, foto ${img + 1}`} slot={SLOTS.product} />
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
                  <Photo src={src} alt={`${p.name}, foto ${i + 1}`} slot={SLOTS.product} />
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
              {v.listPrice !== undefined && v.listPrice > v.price && (
                <s className="was"><span className="visually-hidden">Precio regular </span>{formatPrice(v.listPrice, cur)}</s>
              )}
              {stockBadge && (
                <span className={`badge ${curOut ? "sold" : "low"}`}>
                  <span className="dot" />
                  {stockBadge}
                </span>
              )}
            </div>
            {v.campaign && v.listPrice !== undefined && (
              <p className="small muted">{v.campaign.name} · precio de oferta hasta el {campaignDate(v.campaign.endsAt)}</p>
            )}
          </div>

          {options && (
            <div className="stack g3">
              <span className="label" id="variant-q">{p.optionsLabel || sf.product.variantQuestion}</span>
              <div className="seg" role="radiogroup" aria-labelledby="variant-q">
                {p.variants.map((x) => {
                  const out = unitsLeft(p, x) < min;
                  const s = variantStockLabel(x, p);
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
                      <span className="p">{formatPrice(x.price, cur)}{x.listPrice !== undefined && x.listPrice > x.price && <> <s className="was">{formatPrice(x.listPrice, cur)}</s></>}{s ? ` · ${s}` : ""}</span>
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
                  <button type="button" aria-label="Quitar uno" onClick={() => setQty(Math.max(min, qty - 1))} disabled={qty <= min}>
                    <IconMinus size="sm" />
                  </button>
                  <span aria-live="polite">{qty}</span>
                  <button type="button" aria-label="Agregar uno" onClick={() => setQty(Math.min(left, qty + 1))} disabled={qty >= left}>
                    <IconPlus size="sm" />
                  </button>
                </div>
                <button className="btn grow" type="button" onClick={add}>
                  Agregar al carrito · {formatPrice(v.price * qty, cur)}
                </button>
              </div>
              {min > 1 && (
                <p className="small muted">Pedido mínimo: {min} unidades{options ? " por opción" : ""}.</p>
              )}
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
                      <Link className="btn grow" href={customOrderHref(tenant)}>{isContactForm(tenant) ? tenant.customOrder.label : `Pídela ${tenant.customOrder.label.toLowerCase()}`}</Link>
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
            {options && <span className="small muted">{v.label}</span>}
            <span className="price">{formatPrice(v.price * qty, cur)}</span>
          </div>
          <button className="btn grow" type="button" onClick={add}>Agregar al carrito</button>
        </div>
      )}
      {!curOut && <div className="sticky-spacer" aria-hidden="true" />}
    </>
  );
}
