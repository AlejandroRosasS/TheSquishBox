"use client";

import Link from "next/link";
import { useCart } from "./CartProvider";
import { QtyControl, RemoveButton, VariantSelect } from "./CartLineControls";
import { useStore } from "@/components/StoreContext";
import { Rich } from "@/components/Rich";
import { ProductCard } from "@/components/ProductCard";
import { asset } from "@/lib/assets";
import { formatPrice, plural } from "@/lib/format";
import { lineName } from "@/lib/catalog";
import { IconChevronLeft, IconGift, IconTruck } from "@/components/Icons";

/* eslint-disable @next/next/no-img-element */

export function PaymentLogos() {
  const { tenant } = useStore();
  const logos = tenant.payments.methods.flatMap((m) => (m === "tarjeta" ? ["VISA", "MC"] : [m.toUpperCase()]));
  return (
    <div className="row g2" style={{ justifyContent: "center" }}>
      {logos.map((l) => <span className="pay-logo" key={l}>{l}</span>)}
    </div>
  );
}

export function CartPageView() {
  const { tenant, catalog, storefront: sf } = useStore();
  const cart = useCart();
  const cur = tenant.currency;

  if (!cart.ready) return <div className="wrap" style={{ minHeight: "60vh" }} />;

  if (cart.lines.length === 0) {
    const popular = sf.cart.popularIds.map((id) => catalog.products.find((p) => p.id === id)).filter(Boolean) as typeof catalog.products;
    return (
      <div className="wrap" style={{ paddingBlock: "72px 96px" }}>
        <div className="stack g4" style={{ alignItems: "center", textAlign: "center", maxWidth: 520, margin: "0 auto" }}>
          <span style={{ width: 96, height: 96, borderRadius: "50%", background: "var(--primary-soft)", color: "var(--primary)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <IconGift style={{ width: 44, height: 44, strokeWidth: 1.3 }} />
          </span>
          <h1 className="h2"><Rich text={sf.cart.emptyTitle} /></h1>
          <p className="lead">{sf.cart.emptyLead}</p>
          <div className="row g3 wrap-row" style={{ justifyContent: "center" }}>
            <Link className="btn" href={sf.cart.emptyPrimary.href}>{sf.cart.emptyPrimary.label}</Link>
            {tenant.customOrder.enabled && <Link className="btn ghost" href={sf.cart.emptySecondary.href}>{sf.cart.emptySecondary.label}</Link>}
          </div>
        </div>
        {popular.length > 0 && (
          <div className="stack g5" style={{ marginTop: 72 }}>
            <h2 className="h3">{sf.cart.popularTitle}</h2>
            <div className="pgrid">
              {popular.map((p) => (
                <ProductCard key={p.id} product={p} catalog={catalog} slug={tenant.slug} currency={cur} showBadge={false} />
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="wrap" style={{ paddingBlock: "48px 96px" }}>
      <h1 className="h1" style={{ marginBottom: 32 }}>Tu <em>carrito</em></h1>
      <div className="cart-layout">
        <div className="stack" style={{ borderTop: "1px solid var(--border)" }}>
          {cart.lines.map((it) => (
            <div className="line" key={`${it.productId}/${it.variantId}`}>
              <Link className="ph r45" href={`/p/${it.productId}`}>
                <img src={asset(tenant.slug, it.product.images[0])} alt={it.product.name} />
              </Link>
              <div className="stack g2">
                <p className="small muted">{lineName(catalog, it.product.line)}</p>
                <p className="t">{it.product.name}</p>
                <VariantSelect line={it} currency={cur} />
                <div className="row g4" style={{ marginTop: 6 }}>
                  <QtyControl line={it} />
                  <RemoveButton line={it} />
                </div>
              </div>
              <span className="price line-price">{formatPrice(it.lineTotal, cur)}</span>
            </div>
          ))}
          <Link className="textlink" href="/tienda" style={{ marginTop: 12 }}>
            <IconChevronLeft size="sm" />
            Seguir comprando
          </Link>
        </div>
        <aside className="summary" aria-label="Resumen">
          <p className="h4">Resumen</p>
          <div className="sum-row"><span className="muted">Subtotal ({plural(cart.count, "producto", "productos")})</span><span>{formatPrice(cart.subtotal, cur)}</span></div>
          <div className="sum-row"><span className="muted">Delivery estimado</span><span className="muted">Según distrito</span></div>
          <div className="sum-row total"><span>Total</span><span>{formatPrice(cart.subtotal, cur)}</span></div>
          <Link className="btn block" href="/checkout">Ir a pagar</Link>
          <div className="note"><IconTruck size="sm" /><span>{sf.cart.deliveryNote}</span></div>
          <PaymentLogos />
        </aside>
      </div>
    </div>
  );
}
