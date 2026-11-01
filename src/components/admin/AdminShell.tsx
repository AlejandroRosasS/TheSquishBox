"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { Logo } from "@/components/Logo";
import { useAdmin, useAdminCatalog, useOrders, useParty } from "./AdminContext";
import { AIBell, AIBox, AIChart, AIGift, AIGlobe, AIHome, AIInstagram, AIMore, AIOrders, AIPalette, AISettings, AIText } from "./AdminIcons";
import { isSoldOut, totalStock, LOW_STOCK } from "@/lib/catalog";

type Item = { href: string; label: string; icon: ReactNode; count?: number; exact?: boolean };

function isOn(path: string, item: { href: string; exact?: boolean }) {
  return item.exact ? path === item.href : path === item.href || path.startsWith(`${item.href}/`);
}

export function useAdminCounts() {
  const { demo } = useAdmin();
  const { orders } = useOrders();
  const { requests } = useParty();
  const { catalog } = useAdminCatalog();
  const newOrders = orders.filter((o) => o.status === "nuevo").length;
  const newParty = requests.filter((r) => r.status === "nueva").length;
  const newPosts = demo.igPosts.filter((p) => p.kind === "new").length;
  const lowStock = catalog.products.filter((p) => p.status !== "draft" && (isSoldOut(p) || totalStock(p) <= LOW_STOCK || p.variants.some((v) => v.stock > 0 && v.stock <= 5))).length;
  return { newOrders, newParty, newPosts, lowStock };
}

export function AdminShell({ children }: { children: ReactNode }) {
  const { bundle } = useAdmin();
  const { tenant } = bundle;
  const path = usePathname();
  const c = useAdminCounts();
  const party = tenant.customOrder.enabled;

  const main: Item[] = [
    { href: "/admin", label: "Inicio", icon: <AIHome />, exact: true },
    { href: "/admin/pedidos", label: "Pedidos", icon: <AIOrders />, count: c.newOrders },
    ...(party ? [{ href: "/admin/fiestas", label: tenant.customOrder.adminLabel ?? tenant.customOrder.label, icon: <AIGift />, count: c.newParty }] : []),
    { href: "/admin/productos", label: "Productos", icon: <AIBox /> },
    { href: "/admin/instagram", label: "Instagram", icon: <AIInstagram />, count: c.newPosts },
    { href: "/admin/ventas", label: "Ventas y márgenes", icon: <AIChart /> },
  ];
  const store: Item[] = [
    { href: "/admin/apariencia", label: "Apariencia", icon: <AIPalette /> },
    { href: "/admin/textos", label: "Textos", icon: <AIText /> },
    { href: "/admin/seo", label: "SEO", icon: <AIGlobe /> },
  ];
  const config: Item[] = [
    { href: "/admin/notificaciones", label: "Notificaciones", icon: <AIBell /> },
    { href: "/admin/ajustes", label: "Ajustes", icon: <AISettings /> },
  ];
  const tabs: Item[] = [main[0], main[1], main.find((i) => i.href === "/admin/productos")!, main.find((i) => i.href === "/admin/instagram")!];
  const moreOn = !tabs.some((t) => isOn(path, t));

  const link = (i: Item) => (
    <Link key={i.href} href={i.href} className={isOn(path, i) ? "on" : ""} aria-current={isOn(path, i) ? "page" : undefined}>
      {i.icon}
      {i.label}
      {!!i.count && <span className="cnt">{i.count}</span>}
    </Link>
  );

  return (
    <div className="a-shell">
      <a className="a-skip" href="#contenido">Saltar al contenido</a>
      <aside className="a-side" aria-label="Menú del panel">
        <div className="a-brand">
          <Logo tenant={tenant} size="sm" />
          <div>
            <b>{tenant.name}</b>
            <p className="a-cap">Panel de la tienda</p>
          </div>
        </div>
        <nav className="a-nav stack g1" aria-label="Secciones">
          {main.map(link)}
          <p className="a-navlabel">Tu tienda</p>
          {store.map(link)}
          <p className="a-navlabel">Configuración</p>
          {config.map(link)}
        </nav>
        <div className="stack g2" style={{ marginTop: "auto", paddingTop: 20 }}>
          <a className="a-btn sm" href="/" target="_blank" rel="noreferrer">Ver tienda</a>
          <Link className="a-btn sm ghost" href="/admin/login">Salir</Link>
        </div>
      </aside>
      {children}
      <nav className="a-tabbar" aria-label="Secciones">
        {tabs.map((i) => (
          <Link key={i.href} href={i.href} className={isOn(path, i) ? "on" : ""} aria-current={isOn(path, i) ? "page" : undefined}>
            {i.icon}
            {i.label}
            {!!i.count && <span className="cnt">{i.count}</span>}
          </Link>
        ))}
        <Link href="/admin/ajustes" className={moreOn ? "on" : ""} aria-current={moreOn ? "page" : undefined}>
          <AIMore />
          Más
        </Link>
      </nav>
    </div>
  );
}
