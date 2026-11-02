import type { Line, Product } from "@/lib/types";

export type OrderStatus = "nuevo" | "prep" | "listo" | "entregado" | "cancelado";
export type DemoOrderLine = { productId: string; variantId: string; qty: number; price: number };
export type LogEntry = { t: string; when: string };
export type Note = { who: string; when: string; text: string };

export type DemoOrder = {
  id: string;
  client: string;
  phone: string;
  email: string;
  createdAt: string;
  payment: string;
  lines: DemoOrderLine[];
  district: string;
  address: string;
  reference: string;
  date: string;
  doc: string;
  deliveryFee: number;
  deliveryReal: number | null;
  gift: string;
  notes: Note[];
  log: LogEntry[];
  status: OrderStatus;
  delivery: string;
};

export type PartyStatus = "nueva" | "cotizada" | "aceptada" | "descartada";
export type PartyRequest = {
  id: string;
  name: string;
  when: string;
  phone: string;
  mail: string;
  qty: string;
  theme: string;
  size: string;
  extras: string;
  date: string;
  district: string;
  idea: string;
  img: string;
  refs: string[];
  status: PartyStatus;
  price: string;
  deliveryFee: string;
  proposal: string;
};

export type IgPost = {
  id: string;
  img: string;
  kind: "new" | "done" | "content";
  name: string;
  reel?: boolean;
  caption?: string;
  variants?: string[];
  line?: string;
};

export type Channel = { on: boolean; status: string; recipients: string[]; bot?: string; detail?: string; bad?: string };

export type SaleLine = [productId: string, variantId: string, channel: string, units: number, deliveryIn: number, deliveryOut: number, orders: number];

export type AdminDemo = {
  today: string;
  costs: Record<string, Record<string, number>>;
  lineNotes: Record<string, string>;
  deliveryCosts: Record<string, number>;
  orders: DemoOrder[];
  partyRequests: PartyRequest[];
  igPosts: IgPost[];
  weekSales: { total: number; count: number; contribution: number; bars: number[] };
  notifications: { telegram: Channel; email: Channel; whatsapp: Channel };
  sales: {
    lines: SaleLine[];
    fair: { name: string; dates: string; days: number; fixedCosts: { label: string; amount: number }[] };
    recent: { date: string; detail: string; note: string; channel: string; revenue: number; contribution: number }[];
  };
};

/** Catálogo que edita el admin: el del tenant + costos internos y notas por línea. */
/**
 * `igImages`: las fotos que trajo Instagram (se guardan aunque el equipo las reemplace).
 * `igPostId`: id del post de Instagram (Meta) del que salió el producto.
 * `photosSynced`: false cuando el equipo cambió las fotos a mano; la sincronización ya no las toca.
 */
export type AdminProduct = Product & { stockMode?: "stock" | "none"; available?: boolean; lowAlert?: boolean; igSynced?: boolean; igPostId?: string; igImages?: string[]; photosSynced?: boolean };
export type AdminCatalog = {
  lines: Line[];
  products: AdminProduct[];
  costs: Record<string, Record<string, number>>;
  lineNotes: Record<string, string>;
};
