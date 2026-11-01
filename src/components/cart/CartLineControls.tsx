"use client";

import type { CartLine } from "./CartProvider";
import { useCart } from "./CartProvider";
import { formatPrice } from "@/lib/format";
import { hasOptions } from "@/lib/catalog";
import { IconMinus, IconPlus } from "@/components/Icons";

/** Selector de variante + cantidad + quitar, compartido por el drawer y la página de carrito. */
export function VariantSelect({ line, currency }: { line: CartLine; currency: string }) {
  const { setVariant } = useCart();
  if (!hasOptions(line.product)) return null;
  return (
    <select
      className="select mini-select"
      aria-label={`${line.product.optionsLabel || "Opción"} de ${line.product.name}`}
      value={line.variantId}
      onChange={(e) => setVariant(line.productId, line.variantId, e.target.value)}
      style={{ alignSelf: "flex-start" }}
    >
      {line.product.variants.map((v) => (
        <option key={v.id} value={v.id} disabled={v.stock <= 0}>
          {v.label} · {formatPrice(v.price, currency)}
          {v.stock <= 0 ? " · Agotado" : ""}
        </option>
      ))}
    </select>
  );
}

export function QtyControl({ line, compact }: { line: CartLine; compact?: boolean }) {
  const { setQty } = useCart();
  const btn = compact ? { height: 36, width: 38 } : undefined;
  const atMax = line.qty >= line.variant.stock;
  return (
    <div className="qty" style={compact ? { height: 38 } : undefined}>
      <button
        type="button"
        style={btn}
        onClick={() => setQty(line.productId, line.variantId, line.qty - 1)}
        disabled={line.qty <= 1}
        aria-label={`Quitar uno de ${line.product.name}`}
      >
        <IconMinus size={compact ? "xs" : "sm"} />
      </button>
      <span aria-live="polite">{line.qty}</span>
      <button
        type="button"
        style={btn}
        onClick={() => setQty(line.productId, line.variantId, line.qty + 1)}
        disabled={atMax}
        aria-label={`Agregar uno de ${line.product.name}`}
      >
        <IconPlus size={compact ? "xs" : "sm"} />
      </button>
    </div>
  );
}

export function RemoveButton({ line }: { line: CartLine }) {
  const { remove } = useCart();
  return (
    <button
      className="link small"
      type="button"
      onClick={() => remove(line.productId, line.variantId)}
      style={{ fontSize: 13, minHeight: 44 }}
    >
      Quitar<span className="visually-hidden"> {line.product.name}</span>
    </button>
  );
}
