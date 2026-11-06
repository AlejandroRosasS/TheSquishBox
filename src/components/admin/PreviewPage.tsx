"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import type { TenantBundle } from "@/tenants";
import type { LegalPageKey } from "@/lib/types";
import type { CartItem } from "@/components/cart/CartProvider";
import type { Order } from "@/lib/orders";
import { hasOptions, isSoldOut, lineName, tracksStock, variantImage, visibleProducts } from "@/lib/catalog";
import { Rich } from "@/components/Rich";
import { CatalogView } from "@/components/catalog/CatalogView";
import { ProductPageView } from "@/components/product/ProductPageView";
import { CartPageView } from "@/components/cart/CartPageView";
import { CheckoutView } from "@/components/checkout/CheckoutView";
import { OrderView } from "@/components/checkout/OrderView";
import { LegalView } from "@/components/legal/LegalView";
import { ContactView } from "@/components/legal/ContactView";
import { ComplaintForm } from "@/components/legal/ComplaintForm";
import { PartyForm } from "@/components/party/PartyForm";
import { NotFoundView } from "@/components/NotFoundView";

/** Qué página de la tienda muestra la vista previa de Admin › Textos y dónde está cada sección. */
export type PreviewPage = {
  /** Nombre de la página para el encabezado de la vista previa. */
  where: string;
  /** null = la Home. */
  node: ReactNode | null;
  /** Con cabecera y pie de la tienda (el checkout y la confirmación van sin ellos). */
  chrome: boolean;
  /** Carrito de ejemplo para esta página. */
  cart?: CartItem[];
  /** Dónde buscar los textos de la sección (selectores, en orden). Si no, toda la página. */
  scope?: string[];
};

const LEGAL_NAMES: Record<LegalPageKey, string> = {
  terms: "Términos y condiciones",
  returns: "Cambios y devoluciones",
  shipping: "Entregas",
  privacy: "Privacidad",
};

/** Dos productos disponibles para armar un carrito de ejemplo. */
function demoCart(bundle: TenantBundle): CartItem[] {
  return visibleProducts(bundle.catalog)
    .filter((p) => !isSoldOut(p))
    .flatMap((p) => {
      const v = p.variants.find((x) => x.stock > 0 || !tracksStock(p));
      return v ? [{ productId: p.id, variantId: v.id, qty: 1 }] : [];
    })
    .slice(0, 2);
}

/** Pedido de ejemplo para la página de confirmación (no se guarda). */
function demoOrder(bundle: TenantBundle, cart: CartItem[]): Order {
  const { tenant, catalog, storefront: sf } = bundle;
  const lines = cart.flatMap((it) => {
    const p = catalog.products.find((x) => x.id === it.productId);
    const v = p?.variants.find((x) => x.id === it.variantId);
    if (!p || !v) return [];
    return [{ productId: p.id, name: p.name, variantLabel: hasOptions(p) ? v.label : "", qty: it.qty, price: v.price, image: variantImage(p, v) }];
  });
  const subtotal = lines.reduce((a, l) => a + l.price * l.qty, 0);
  const district = sf.checkout.defaultDistrict;
  const fee = sf.checkout.deliveryRates[district] ?? null;
  const date = new Date(Date.now() + 3 * 864e5).toISOString().slice(0, 10);
  return {
    id: "1024",
    createdAt: new Date().toISOString(),
    customer: { name: "Ana (ejemplo)", phone: "", email: "ana@ejemplo.com" },
    shipping: { type: "delivery", address: "Dirección de ejemplo", district, reference: "", date, recipient: "", gift: "" },
    doc: { type: "boleta", dni: "" },
    payment: { method: tenant.payments.methods[0] ?? "yape" },
    lines,
    subtotal,
    deliveryFee: fee,
    total: subtotal + (fee ?? 0),
  };
}

function CatalogPreview({ bundle }: { bundle: TenantBundle }) {
  const sf = bundle.storefront;
  return (
    <div className="wrap">
      <nav className="crumbs" aria-label="Ruta">
        <Link href="/">Inicio</Link>
        <span aria-hidden="true">/</span>
        <span>Toda la tienda</span>
      </nav>
      <div className="stack g3" style={{ paddingBottom: 32 }}>
        <h1 className="h1"><Rich text={sf.catalog.title} /></h1>
        <p className="lead" style={{ maxWidth: 640 }}>{sf.catalog.lead}</p>
      </div>
      <CatalogView initialLine="all" />
    </div>
  );
}

/**
 * Página que corresponde a la sección (y al campo) que se está editando.
 * `path` es el campo con foco, por ejemplo "legalPages.returns.sections.2.text".
 */
export function previewPage(secId: string, path: string | null, bundle: TenantBundle): PreviewPage {
  const parts = path?.split(".") ?? [];
  const { catalog, storefront: sf } = bundle;
  switch (secId) {
    case "top":
      return { where: "Inicio · cabecera (se ve en todas las páginas)", node: null, chrome: true, scope: [".announce", ".header"] };
    case "footer":
      return { where: "Inicio · pie de página (se ve en todas las páginas)", node: null, chrome: true, scope: [".footer"] };
    case "business":
      if (parts[0] === "contact") return { where: "Contacto", node: <ContactView bundle={bundle} />, chrome: true, scope: ["main"] };
      return { where: "Inicio · pie de página (también en Contacto y páginas legales)", node: null, chrome: true, scope: [".footer"] };
    case "legalPages": {
      const key = (parts[1] in sf.legalPages ? parts[1] : "terms") as LegalPageKey;
      return { where: LEGAL_NAMES[key], node: <LegalView bundle={bundle} page={key} />, chrome: true, scope: ["main"] };
    }
    case "complaints":
      return { where: "Libro de reclamaciones", node: <ComplaintForm />, chrome: true, scope: ["main"] };
    case "catalog":
      return { where: "Tienda", node: <CatalogPreview bundle={bundle} />, chrome: true, scope: ["main"] };
    case "product": {
      const list = visibleProducts(catalog);
      const wantSoldOut = /soldOut/.test(parts[1] ?? "");
      const p = (wantSoldOut && list.find(isSoldOut)) || list.find((x) => hasOptions(x) && !isSoldOut(x)) || list[0];
      if (!p) return { where: "Página de producto", node: null, chrome: true };
      return { where: `Producto · ${p.name} (${lineName(catalog, p.line)})`, node: <ProductPageView bundle={bundle} product={p} />, chrome: true, scope: ["main"] };
    }
    case "cart": {
      // Los textos del carrito vacío y «los más pedidos» se ven sin productos; el resto, con productos.
      const empty = !parts[1] || /^(empty|popular)/.test(parts[1]);
      return { where: empty ? "Carrito vacío" : "Carrito con productos (ejemplo)", node: <CartPageView />, chrome: true, cart: empty ? [] : demoCart(bundle), scope: ["main"] };
    }
    case "checkout":
      return { where: "Finalizar compra (carrito de ejemplo)", node: <CheckoutView />, chrome: false, cart: demoCart(bundle), scope: ["main"] };
    case "confirmation": {
      const cart = demoCart(bundle);
      return { where: "Pedido confirmado (pedido de ejemplo)", node: <OrderView id="1024" demo={demoOrder(bundle, cart)} />, chrome: false, scope: ["main"] };
    }
    case "party":
      return { where: "Pedido especial", node: <PartyForm />, chrome: true, scope: ["main"] };
    case "notFound":
      return {
        where: "Página no encontrada (404)",
        node: <div className="wrap" style={{ paddingBlock: "72px 112px" }}><NotFoundView bundle={bundle} /></div>,
        chrome: true,
        scope: ["main"],
      };
    default:
      return { where: "Inicio", node: null, chrome: true, scope: [`[data-edit="${secId}"]`] };
  }
}
