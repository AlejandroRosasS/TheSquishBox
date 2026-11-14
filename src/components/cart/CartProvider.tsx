"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Product, Variant } from "@/lib/types";
import { useStore } from "@/components/StoreContext";
import { minQty } from "@/lib/catalog";
import { gaItem, gaValue, track } from "@/lib/analytics";

export type CartItem = { productId: string; variantId: string; qty: number };
export type CartLine = CartItem & { product: Product; variant: Variant; lineTotal: number };

type CartState = {
  ready: boolean;
  lines: CartLine[];
  count: number;
  subtotal: number;
  drawerOpen: boolean;
  lastAdded: CartLine | null;
  add: (productId: string, variantId: string, qty?: number) => void;
  setQty: (productId: string, variantId: string, qty: number) => void;
  setVariant: (productId: string, fromVariant: string, toVariant: string) => void;
  remove: (productId: string, variantId: string) => void;
  clear: () => void;
  openDrawer: () => void;
  closeDrawer: () => void;
};

const Ctx = createContext<CartState | null>(null);

/** `demo`: carrito fijo de ejemplo (vistas previas del admin): no lee ni guarda el carrito del navegador. */
export function CartProvider({ children, demo }: { children: ReactNode; demo?: CartItem[] }) {
  const { tenant, catalog } = useStore();
  const key = `cart:${tenant.slug}`;
  const [items, setItems] = useState<CartItem[]>(demo ?? []);
  const [ready, setReady] = useState(!!demo);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [lastKey, setLastKey] = useState<string | null>(null);

  useEffect(() => {
    if (demo) return;
    try {
      const raw = localStorage.getItem(key);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- leer el carrito guardado al montar
      if (raw) setItems(JSON.parse(raw));
    } catch {}
    setReady(true);
  }, [key, demo]);

  useEffect(() => {
    if (ready && !demo) localStorage.setItem(key, JSON.stringify(items));
  }, [items, key, ready, demo]);

  useEffect(() => {
    document.body.classList.toggle("no-scroll", drawerOpen);
  }, [drawerOpen]);

  const lines = useMemo<CartLine[]>(
    () =>
      items.flatMap((it) => {
        const product = catalog.products.find((p) => p.id === it.productId);
        const variant = product?.variants.find((v) => v.id === it.variantId);
        if (!product || !variant) return [];
        // Un carrito guardado antes de que la marca pusiera un pedido mínimo se sube al mínimo.
        const qty = Math.max(minQty(product), it.qty);
        return [{ ...it, qty, product, variant, lineTotal: variant.price * qty }];
      }),
    [items, catalog],
  );

  const maxQty = useCallback(
    (productId: string, variantId: string) =>
      catalog.products.find((p) => p.id === productId)?.variants.find((v) => v.id === variantId)?.stock ?? 0,
    [catalog],
  );
  const minOf = useCallback(
    (productId: string) => {
      const p = catalog.products.find((x) => x.id === productId);
      return p ? minQty(p) : 1;
    },
    [catalog],
  );

  const add = useCallback(
    (productId: string, variantId: string, qty = 1) => {
      const max = maxQty(productId, variantId);
      const min = minOf(productId);
      if (max < min) return;
      if (!demo) {
        const product = catalog.products.find((p) => p.id === productId);
        const variant = product?.variants.find((v) => v.id === variantId);
        if (product && variant) {
          const units = Math.min(max, Math.max(min, qty));
          track("add_to_cart", { currency: tenant.currency, value: gaValue(variant.price * units), items: [gaItem(product, variant, units, catalog.lines)] });
        }
      }
      setItems((prev) => {
        const found = prev.find((x) => x.productId === productId && x.variantId === variantId);
        if (found)
          return prev.map((x) => (x === found ? { ...x, qty: Math.min(max, Math.max(min, x.qty + qty)) } : x));
        return [...prev, { productId, variantId, qty: Math.min(max, Math.max(min, qty)) }];
      });
      setLastKey(`${productId}/${variantId}`);
      setDrawerOpen(true);
    },
    [maxQty, minOf, demo, catalog, tenant.currency],
  );

  const setQty = useCallback(
    (productId: string, variantId: string, qty: number) => {
      const max = maxQty(productId, variantId);
      const min = minOf(productId);
      setItems((prev) =>
        prev.map((x) =>
          x.productId === productId && x.variantId === variantId ? { ...x, qty: Math.max(min, Math.min(max, qty)) } : x,
        ),
      );
    },
    [maxQty, minOf],
  );

  const setVariant = useCallback((productId: string, fromVariant: string, toVariant: string) => {
    setItems((prev) => {
      const target = prev.find((x) => x.productId === productId && x.variantId === toVariant);
      const source = prev.find((x) => x.productId === productId && x.variantId === fromVariant);
      if (!source) return prev;
      if (target) {
        return prev
          .filter((x) => x !== source)
          .map((x) => (x === target ? { ...x, qty: x.qty + source.qty } : x));
      }
      return prev.map((x) => (x === source ? { ...x, variantId: toVariant } : x));
    });
  }, []);

  const remove = useCallback((productId: string, variantId: string) => {
    setItems((prev) => prev.filter((x) => !(x.productId === productId && x.variantId === variantId)));
  }, []);

  const value: CartState = {
    ready,
    lines,
    count: lines.reduce((s, l) => s + l.qty, 0),
    subtotal: lines.reduce((s, l) => s + l.lineTotal, 0),
    drawerOpen,
    lastAdded: lines.find((l) => `${l.productId}/${l.variantId}` === lastKey) ?? null,
    add,
    setQty,
    setVariant,
    remove,
    clear: () => setItems([]),
    openDrawer: () => {
      setLastKey(null);
      setDrawerOpen(true);
    },
    closeDrawer: () => setDrawerOpen(false),
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCart(): CartState {
  const v = useContext(Ctx);
  if (!v) throw new Error("useCart fuera de CartProvider");
  return v;
}
