"use client";

import type { CartLine } from "./CartProvider";
import { useCart } from "./CartProvider";
import { formatPrice } from "@/lib/format";
import { hasOptions, minQty } from "@/lib/catalog";
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
        <option key={v.id} value={v.id} disabled={v.stock < minQty(line.product)}>
          {v.label} · {formatPrice(v.price, currency)}
          {v.stock < minQty(line.product) ? " · Agotado" : ""}
        </option>
      ))}
    </select>
  );
}

export function QtyControl({ line, compact }: { line: CartLine; compact?: boolean }) {
  const { setQty } = useCart();
  const btn = compact ? { height: 36, width: 38 } : undefined;
  const atMax = line.qty >= line.variant.stock;
  const min = minQty(line.product);
  return (
    <div className="qty" style={compact ? { height: 38 } : undefined}>
      <button
        type="button"
        style={btn}
        onClick={() => setQty(line.productId, line.variantId, line.qty - 1)}
        disabled={line.qty <= min}
        aria-label={`Quitar uno de ${line.product.name}`}
        title={min > 1 && line.qty <= min ? `Pedido mínimo: ${min} unidades` : undefined}
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

/** «Pedido mínimo: N» debajo de la cantidad, solo si el producto tiene un mínimo mayor a 1. */
export function MinQtyNote({ line }: { line: CartLine }) {
  const min = minQty(line.product);
  if (min <= 1) return null;
  return <p className="small muted" style={{ fontSize: 12 }}>Pedido mínimo: {min} unidades</p>;
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
