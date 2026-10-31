/** Pedidos de la demo (Fase 1): se guardan en el navegador. En Fase 3 van a la base de datos. */
export type OrderLine = { productId: string; name: string; variantLabel: string; qty: number; price: number; image: string };

export type Order = {
  id: string;
  createdAt: string;
  customer: { name: string; phone: string; email: string };
  shipping:
    | { type: "delivery"; address: string; district: string; reference: string; date: string; recipient: string; gift: string }
    | { type: "pickup"; date: string };
  doc: { type: "boleta"; dni: string } | { type: "factura"; ruc: string; razon: string };
  payment: { method: string };
  lines: OrderLine[];
  subtotal: number;
  deliveryFee: number | null;
  total: number;
};

const key = (slug: string) => `orders:${slug}`;

export function loadOrders(slug: string): Order[] {
  try {
    return JSON.parse(localStorage.getItem(key(slug)) || "[]");
  } catch {
    return [];
  }
}

export function saveOrder(slug: string, data: Omit<Order, "id" | "createdAt">): Order {
  const orders = loadOrders(slug);
  const next = orders.reduce((m, o) => Math.max(m, Number(o.id) || 0), 0) + 1;
  const order: Order = { ...data, id: String(next).padStart(4, "0"), createdAt: new Date().toISOString() };
  localStorage.setItem(key(slug), JSON.stringify([...orders, order]));
  return order;
}

export function findOrder(slug: string, id: string): Order | null {
  return loadOrders(slug).find((o) => o.id === id) ?? null;
}

export function formatDate(iso: string, opts: Intl.DateTimeFormatOptions = { weekday: "short", day: "numeric", month: "short", year: "numeric" }) {
  if (!iso) return "";
  const d = new Date(`${iso}T12:00:00`);
  return new Intl.DateTimeFormat("es-PE", opts).format(d);
}
