"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { Logo } from "@/components/Logo";
import { useAdmin, useAdminCatalog, useOrders, useParty } from "./AdminContext";
import { AuthGate, SignOutButton } from "./AuthGate";
import { InventoryProvider, useInventory } from "./AdminInventory";
import { useBrandTenant } from "./useBrand";
import { PANEL_SUBTITLE } from "@/lib/brand";
import { useToday } from "@/lib/useToday";
import { useRole } from "./useRole";
import { useDb } from "./DbContext";
import { canSee, isManager } from "@/lib/team/roles";
import { AIUsers, AIBell, AIBox, AILayers, AIChart, AIGlobe, AIHome, AIInstagram, AIMore, AIOrders, AIPalette, AISettings, AIText, AIImage, AIBook, AIStar } from "./AdminIcons";
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

/** El menú marca la sección activa con usePathname, que en rutas dinámicas debe ir dentro de Suspense. */
export function AdminShell({ children }: { children: ReactNode }) {
  return (
    <AuthGate>
      <InventoryProvider>
        <Suspense fallback={<ShellInner path="">{children}</ShellInner>}>
          <ShellWithPath>{children}</ShellWithPath>
        </Suspense>
      </InventoryProvider>
    </AuthGate>
  );
}

function ShellWithPath({ children }: { children: ReactNode }) {
  return <ShellInner path={usePathname()}>{children}</ShellInner>;
}

function ShellInner({ children, path }: { children: ReactNode; path: string }) {
  const { tenant, resolve } = useBrandTenant();
  const c = useAdminCounts();
  const party = tenant.customOrder.enabled;
  // Se sabe recién en el navegador (demo: localStorage; base: se carga al entrar), así no cambia el HTML al hidratar.
  const mounted = !!useToday();
  const inventoryOn = useInventory().data.enabled;
  const inventory = mounted && inventoryOn;
  const role = useRole();
  const db = useDb();
  const meUser = db?.state.phase === "ready" ? db.state.user : null;
  const meName = String(meUser?.user_metadata?.full_name ?? "").trim() || meUser?.email || "Tu cuenta";

  const main: Item[] = [
    { href: "/admin", label: "Inicio", icon: <AIHome />, exact: true },
    { href: "/admin/pedidos", label: "Pedidos", icon: <AIOrders />, count: c.newOrders + (party ? c.newParty : 0) },
    { href: "/admin/productos", label: "Productos", icon: <AIBox /> },
    ...(inventory ? [{ href: "/admin/inventario", label: "Inventario", icon: <AILayers /> }] : []),
    { href: "/admin/instagram", label: "Instagram", icon: <AIInstagram />, count: c.newPosts },
    { href: "/admin/resenas", label: "Reseñas", icon: <AIStar /> },
    { href: "/admin/ventas", label: "Ventas y márgenes", icon: <AIChart /> },
  ];
  const store: Item[] = [
    { href: "/admin/apariencia", label: "Apariencia", icon: <AIPalette /> },
    { href: "/admin/textos", label: "Textos", icon: <AIText /> },
    { href: "/admin/fotos", label: "Fotos", icon: <AIImage /> },
    { href: "/admin/seo", label: "SEO", icon: <AIGlobe /> },
  ];
  const config: Item[] = [
    { href: "/admin/notificaciones", label: "Notificaciones", icon: <AIBell /> },
    { href: "/admin/reclamaciones", label: "Reclamaciones", icon: <AIBook /> },
    { href: "/admin/usuarios", label: "Usuarios", icon: <AIUsers /> },
    { href: "/admin/ajustes", label: "Ajustes", icon: <AISettings /> },
  ];
  const allowed = (i: Item) => canSee(role, i.href);
  const tabs: Item[] = [main[0], main[1], main.find((i) => i.href === "/admin/productos")!, main.find((i) => i.href === "/admin/instagram")!];
  const moreOn = !tabs.some((t) => isOn(path, t));
  // El perfil Ventas no entra a Ajustes: su «Más» lleva a Mi perfil, que lista sus secciones.
  const moreHref = isManager(role) ? "/admin/ajustes" : "/admin/perfil";
  const storeItems = store.filter(allowed);
  const configItems = config.filter(allowed);

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
          <Logo tenant={tenant} size="sm" resolve={resolve} />
          <div className="a-brand-txt">
            <b>{tenant.name}</b>
            <p className="a-cap">{tenant.panelSubtitle ?? PANEL_SUBTITLE}</p>
          </div>
        </div>
        <nav className="a-nav stack g1" aria-label="Secciones">
          {main.filter(allowed).map(link)}
          {storeItems.length > 0 && <p className="a-navlabel">Tu tienda</p>}
          {storeItems.map(link)}
          {configItems.length > 0 && <p className="a-navlabel">Configuración</p>}
          {configItems.map(link)}
        </nav>
        <div className="stack g2" style={{ marginTop: "auto", paddingTop: 20 }}>
          <Link className={`a-me ${isOn(path, { href: "/admin/perfil" }) ? "on" : ""}`} href="/admin/perfil" aria-current={isOn(path, { href: "/admin/perfil" }) ? "page" : undefined}>
            <span className="a-me-av" aria-hidden="true">{initials(meName)}</span>
            <span className="a-me-txt">
              <b>{meName}</b>
              <span className="a-cap">Mi perfil</span>
            </span>
          </Link>
          <a className="a-btn sm" href="/" target="_blank" rel="noreferrer">Ver tienda</a>
          <SignOutButton />
        </div>
      </aside>
      {canSee(role, path || "/admin") ? children : <NoPermission />}
      <nav className="a-tabbar" aria-label="Secciones">
        {tabs.map((i) => (
          <Link key={i.href} href={i.href} className={isOn(path, i) ? "on" : ""} aria-current={isOn(path, i) ? "page" : undefined}>
            {i.icon}
            {i.label}
            {!!i.count && <span className="cnt">{i.count}</span>}
          </Link>
        ))}
        <Link href={moreHref} className={moreOn ? "on" : ""} aria-current={moreOn ? "page" : undefined}>
          <AIMore />
          Más
        </Link>
      </nav>
    </div>
  );
}

export function initials(name: string): string {
  const base = name.includes("@") ? name.split("@")[0].replace(/[._-]+/g, " ") : name;
  const parts = base.replace(/[^\p{L}\p{N}\s]/gu, " ").trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "?") + (parts[1]?.[0] ?? "")).toUpperCase();
}

function NoPermission() {
  return (
    <main className="a-main" id="contenido">
      <div className="a-card stack g3" style={{ maxWidth: 520 }}>
        <h1 className="a-h1">Esta sección no es para tu perfil</h1>
        <p className="a-sub">Tu perfil es Ventas: ves pedidos, productos, inventario, ventas, Instagram y reclamaciones. Si necesitas entrar aquí, pídele a un Dueño de la marca que cambie tu perfil en Usuarios.</p>
        <div className="row g2">
          <Link className="a-btn primary" href="/admin">Ir al inicio</Link>
          <Link className="a-btn" href="/admin/perfil">Mi perfil</Link>
        </div>
      </div>
    </main>
  );
}
