"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { useStore } from "./StoreContext";
import { useCart } from "./cart/CartProvider";
import { Logo } from "./Logo";
import { IconBag, IconClose, IconMenu, IconSearch } from "./Icons";
import { plural } from "@/lib/format";

function isActive(href: string, path: string, linea: string | null) {
  const [p, q] = href.split("?");
  if (p !== path) return false;
  if (!q) return true;
  return new URLSearchParams(q).get("linea") === linea;
}

function Nav() {
  const { storefront } = useStore();
  const path = usePathname();
  const linea = useSearchParams().get("linea");
  return (
    <nav className="nav only-d" aria-label="Principal">
      {storefront.nav.map((n, i) => (
        <Link key={i} href={n.href} className={isActive(n.href, path, linea) ? "on" : ""} aria-current={isActive(n.href, path, linea) ? "page" : undefined}>
          {n.label}
        </Link>
      ))}
    </nav>
  );
}

export function Header() {
  const { tenant, storefront } = useStore();
  const cart = useCart();
  const [menu, setMenu] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const path = usePathname();

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- cerrar el menú al navegar
    setMenu(false);
  }, [path]);

  useEffect(() => {
    if (!menu) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMenu(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menu]);

  const count = cart.ready ? cart.count : 0;

  return (
    <>
      <div className="announce">{storefront.announce}</div>
      <header className="header">
        <div className="wrap header-in">
          <Suspense fallback={<nav className="nav only-d" aria-label="Principal" />}>
            <Nav />
          </Suspense>
          <button className="icon-btn only-m" type="button" aria-label="Abrir menú" aria-expanded={menu} onClick={() => setMenu(true)}>
            <IconMenu />
          </button>
          <Logo tenant={tenant} href="/" className="logo-slot" />
          <div className="h-actions">
            <Link className="icon-btn only-d" href="/tienda" aria-label="Buscar">
              <IconSearch />
            </Link>
            <button
              className="icon-btn"
              type="button"
              aria-label={count ? `Carrito, ${plural(count, "producto", "productos")}` : "Carrito"}
              onClick={cart.openDrawer}
            >
              <IconBag />
              {count > 0 && <span className="cart-count">{count}</span>}
            </button>
          </div>
        </div>
      </header>

      {menu && (
        <div className="drawer-root">
          <button className="drawer-bg" type="button" aria-label="Cerrar menú" tabIndex={-1} onClick={() => setMenu(false)} />
          <aside className="drawer left" role="dialog" aria-modal="true" aria-label="Menú">
            <div className="drawer-h">
              <Logo tenant={tenant} size="sm" />
              <button ref={closeRef} className="icon-btn" type="button" aria-label="Cerrar menú" onClick={() => setMenu(false)}>
                <IconClose />
              </button>
            </div>
            <nav className="mmenu" aria-label="Menú principal">
              <Link href="/">Inicio</Link>
              <Link href="/tienda">Toda la tienda</Link>
              {storefront.nav.map((n, i) => (
                <Link key={i} href={n.href}>
                  {n.label}
                </Link>
              ))}
              <Link href="/carrito">Carrito</Link>
            </nav>
          </aside>
        </div>
      )}
    </>
  );
}
