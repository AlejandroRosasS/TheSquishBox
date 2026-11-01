"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { useCart } from "./CartProvider";
import { QtyControl, RemoveButton, VariantSelect } from "./CartLineControls";
import { useStore } from "@/components/StoreContext";
import { asset } from "@/lib/assets";
import { hasOptions, variantImage } from "@/lib/catalog";
import { formatPrice, plural } from "@/lib/format";
import { IconCheck, IconClose } from "@/components/Icons";

export function CartDrawer() {
  const { tenant, storefront } = useStore();
  const cart = useCart();
  const closeRef = useRef<HTMLButtonElement>(null);
  const cur = tenant.currency;

  useEffect(() => {
    if (!cart.drawerOpen) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && cart.closeDrawer();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [cart.drawerOpen, cart]);

  if (!cart.drawerOpen) return null;

  return (
    <div className="drawer-root">
      <button className="drawer-bg" type="button" aria-label="Cerrar carrito" tabIndex={-1} onClick={cart.closeDrawer} />
      <aside className="drawer" role="dialog" aria-modal="true" aria-label="Carrito">
        <div className="drawer-h">
          <div className="row g2">
            <p className="h4">Tu carrito</p>
            <span className="small muted">({plural(cart.count, "producto", "productos")})</span>
          </div>
          <button ref={closeRef} className="icon-btn" type="button" aria-label="Cerrar" onClick={cart.closeDrawer}>
            <IconClose />
          </button>
        </div>

        {cart.lastAdded && (
          <div className="note" style={{ margin: "16px 24px 0", borderRadius: 12 }} role="status">
            <IconCheck size="sm" />
            <span>
              Agregaste{" "}
              <b>
                {cart.lastAdded.product.name}
                {hasOptions(cart.lastAdded.product) ? ` · ${cart.lastAdded.variant.label}` : ""}
              </b>
            </span>
          </div>
        )}

        {cart.lines.length === 0 ? (
          <div className="drawer-b">
            <div className="stack g4" style={{ alignItems: "center", textAlign: "center", paddingBlock: 48 }}>
              <p className="h4">Tu carrito está vacío</p>
              <p className="small muted">{storefront.cart.emptyLead}</p>
              <Link className="btn" href={storefront.cart.emptyPrimary.href} onClick={cart.closeDrawer}>
                {storefront.cart.emptyPrimary.label}
              </Link>
            </div>
          </div>
        ) : (
          <>
            <div className="drawer-b">
              {cart.lines.map((it) => (
                <div className="line" key={`${it.productId}/${it.variantId}`} style={{ gridTemplateColumns: "80px minmax(0, 1fr)" }}>
                  <div className="ph r45" style={{ width: 80 }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={asset(tenant.slug, variantImage(it.product, it.variant))} alt={it.product.name} />
                  </div>
                  <div className="stack g2">
                    <div className="row between g2" style={{ alignItems: "flex-start" }}>
                      <p className="t" style={{ fontSize: 18 }}>{it.product.name}</p>
                      <span className="price" style={{ fontSize: 14 }}>{formatPrice(it.lineTotal, cur)}</span>
                    </div>
                    <VariantSelect line={it} currency={cur} />
                    <div className="row between" style={{ marginTop: 4 }}>
                      <QtyControl line={it} compact />
                      <RemoveButton line={it} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="drawer-f">
              <div className="sum-row">
                <span>Subtotal</span>
                <b>{formatPrice(cart.subtotal, cur)}</b>
              </div>
              <p className="small muted">El delivery se calcula en el checkout según tu distrito.</p>
              <Link className="btn block" href="/checkout" onClick={cart.closeDrawer}>
                Ir a pagar
              </Link>
              <Link className="btn ghost block" href="/carrito" onClick={cart.closeDrawer}>
                Ver carrito
              </Link>
            </div>
          </>
        )}
      </aside>
    </div>
  );
}
