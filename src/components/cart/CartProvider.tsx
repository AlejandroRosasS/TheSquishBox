"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Product, Variant } from "@/lib/types";
import { useStore } from "@/components/StoreContext";

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

export function CartProvider({ children }: { children: ReactNode }) {
  const { tenant, catalog } = useStore();
  const key = `cart:${tenant.slug}`;
  const [items, setItems] = useState<CartItem[]>([]);
  const [ready, setReady] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [lastKey, setLastKey] = useState<string | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(key);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- leer el carrito guardado al montar
      if (raw) setItems(JSON.parse(raw));
    } catch {}
    setReady(true);
  }, [key]);

  useEffect(() => {
    if (ready) localStorage.setItem(key, JSON.stringify(items));
  }, [items, key, ready]);

  useEffect(() => {
    document.body.classList.toggle("no-scroll", drawerOpen);
  }, [drawerOpen]);

  const lines = useMemo<CartLine[]>(
    () =>
      items.flatMap((it) => {
        const product = catalog.products.find((p) => p.id === it.productId);
        const variant = product?.variants.find((v) => v.id === it.variantId);
        if (!product || !variant) return [];
        return [{ ...it, product, variant, lineTotal: variant.price * it.qty }];
      }),
    [items, catalog],
  );

  const maxQty = useCallback(
    (productId: string, variantId: string) =>
      catalog.products.find((p) => p.id === productId)?.variants.find((v) => v.id === variantId)?.stock ?? 0,
    [catalog],
  );

  const add = useCallback(
    (productId: string, variantId: string, qty = 1) => {
      const max = maxQty(productId, variantId);
      if (max <= 0) return;
      setItems((prev) => {
        const found = prev.find((x) => x.productId === productId && x.variantId === variantId);
        if (found)
          return prev.map((x) => (x === found ? { ...x, qty: Math.min(max, x.qty + qty) } : x));
        return [...prev, { productId, variantId, qty: Math.min(max, qty) }];
      });
      setLastKey(`${productId}/${variantId}`);
      setDrawerOpen(true);
    },
    [maxQty],
  );

  const setQty = useCallback(
    (productId: string, variantId: string, qty: number) => {
      const max = maxQty(productId, variantId);
      setItems((prev) =>
        prev.map((x) =>
          x.productId === productId && x.variantId === variantId ? { ...x, qty: Math.max(1, Math.min(max, qty)) } : x,
        ),
      );
    },
    [maxQty],
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
