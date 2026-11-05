"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { DemoOrder, PartyRequest } from "@/lib/admin/types";
import { dataKey, usePersisted } from "@/lib/admin/storage";
import { PARTY_STATUS } from "@/lib/admin/format";
import {
  ORDER_COLUMNS, PARTY_TO_DB, kickAlerts, STATUS_TO_DB, toAdminOrder, toAdminParty, orderCode, partyCode,
  type DbOrder, type DbParty, type EventRow, type OrderRow,
} from "@/lib/db/orders";
import { useAdmin } from "./AdminContext";
import { useDb } from "./DbContext";

export type OrderPatch = Partial<DemoOrder> & { link?: string; refund?: string; paymentStatus?: string };
export type AdminOrder = DemoOrder & { link: string; refund: string; dbId?: string; paymentStatus?: string };

type Ctx = {
  orders: DbOrder[];
  parties: DbParty[];
  loaded: boolean;
  updateOrder: (id: string, patch: OrderPatch) => void;
  updateParty: (id: string, patch: Partial<PartyRequest>) => void;
};

const OrdersCtx = createContext<Ctx | null>(null);

/** Pedidos de la base (tienda y fiestas). Sin Supabase no se monta y el admin usa los pedidos de ejemplo. */
export function OrdersProvider({ children }: { children: ReactNode }) {
  const db = useDb();
  if (!db) return <>{children}</>;
  return <OrdersProviderInner>{children}</OrdersProviderInner>;
}

const DEBOUNCE_MS = 600;

function OrdersProviderInner({ children }: { children: ReactNode }) {
  const db = useDb()!;
  const { bundle, toast } = useAdmin();
  const { client, state } = db;
  const tenantId = state.phase === "ready" ? state.tenantId : null;
  const [rows, setRows] = useState<OrderRow[]>([]);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  const rowsRef = useRef(rows);
  useEffect(() => {
    rowsRef.current = rows;
  }, [rows]);

  const load = useCallback(async () => {
    if (!tenantId) return;
    const { data, error } = await client
      .from("orders")
      .select(ORDER_COLUMNS)
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) return toast(`No se pudieron cargar los pedidos: ${error.message}`);
    const list = (data ?? []) as OrderRow[];
    const ids = list.map((r) => r.id);
    let evs: EventRow[] = [];
    if (ids.length) {
      const res = await client.from("order_events").select("id, order_id, kind, text, created_at").in("order_id", ids);
      if (res.error) toast(`No se pudo cargar la actividad: ${res.error.message}`);
      evs = (res.data ?? []) as EventRow[];
    }
    setRows(list);
    setEvents(evs);
    setLoaded(true);
    // Respaldo del cron: si algún aviso quedó pendiente, se envía ahora.
    kickAlerts();
  }, [client, tenantId, toast]);

  // Carga al entrar y vuelve a cargar al regresar a la pestaña o cada minuto, para ver los pedidos nuevos.
  useEffect(() => {
    if (!tenantId) return;
    const first = setTimeout(() => void load(), 0);
    const onVisible = () => document.visibilityState === "visible" && void load();
    document.addEventListener("visibilitychange", onVisible);
    const every = setInterval(() => document.visibilityState === "visible" && void load(), 60_000);
    return () => {
      clearTimeout(first);
      clearInterval(every);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [tenantId, load]);

  // Cambios de columnas: se aplican al instante en pantalla y se guardan en la base agrupados (para no escribir en cada tecla).
  const pending = useRef<Record<string, Partial<OrderRow>>>({});
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const flush = useCallback(
    async (dbId: string) => {
      const patch = pending.current[dbId];
      delete pending.current[dbId];
      if (!patch) return;
      const { error } = await client.from("orders").update(patch).eq("id", dbId);
      if (error) {
        toast(`No se pudo guardar el pedido: ${error.message}`);
        void load();
      }
    },
    [client, load, toast],
  );

  useEffect(() => {
    const t = timers.current;
    return () => {
      for (const [id, timer] of Object.entries(t)) {
        clearTimeout(timer);
        void flush(id);
      }
    };
  }, [flush]);

  const patchRow = useCallback(
    (dbId: string, patch: Partial<OrderRow>, immediate = false) => {
      setRows((prev) => prev.map((r) => (r.id === dbId ? { ...r, ...patch } : r)));
      pending.current[dbId] = { ...(pending.current[dbId] ?? {}), ...patch };
      clearTimeout(timers.current[dbId]);
      timers.current[dbId] = setTimeout(() => void flush(dbId), immediate ? 0 : DEBOUNCE_MS);
    },
    [flush],
  );

  const addEvent = useCallback(
    async (dbId: string, kind: string, text: string) => {
      if (!tenantId) return;
      const temp: EventRow = { id: -Date.now(), order_id: dbId, kind, text, created_at: new Date().toISOString() };
      setEvents((prev) => [...prev, temp]);
      const { error } = await client.from("order_events").insert({ tenant_id: tenantId, order_id: dbId, kind, text, author: state.phase === "ready" ? state.user.id : null });
      if (error) toast(`No se pudo guardar la actividad: ${error.message}`);
    },
    [client, state, tenantId, toast],
  );

  const orders = useMemo(() => rows.filter((r) => r.kind === "store").map((r) => toAdminOrder(r, events, bundle.catalog)), [rows, events, bundle.catalog]);
  const parties = useMemo(() => rows.filter((r) => r.kind === "party").map(toAdminParty), [rows]);

  const updateOrder = useCallback(
    (id: string, patch: OrderPatch) => {
      const row = rowsRef.current.find((r) => r.kind === "store" && orderCode(r.number) === id);
      if (!row) return;
      const current = toAdminOrder(row, events, bundle.catalog);
      const cols: Partial<OrderRow> = {};
      if (patch.status && patch.status !== current.status) cols.status = STATUS_TO_DB[patch.status];
      if ("deliveryReal" in patch) cols.delivery_cost = patch.deliveryReal ?? null;
      if (patch.link !== undefined || patch.refund !== undefined) {
        cols.delivery = {
          ...row.delivery,
          ...(patch.link !== undefined ? { diff_link: patch.link } : {}),
          ...(patch.refund !== undefined ? { refund: patch.refund } : {}),
        };
      }
      if (patch.paymentStatus) cols.payment_status = patch.paymentStatus;
      if (Object.keys(cols).length) patchRow(row.id, cols, !("deliveryReal" in patch));
      // Las pantallas agregan la entrada nueva al inicio de la lista.
      if (patch.log && patch.log.length > current.log.length) void addEvent(row.id, patch.status ? "status" : "log", patch.log[0].t);
      if (patch.notes && patch.notes.length > current.notes.length) void addEvent(row.id, "note", patch.notes[0].text);
    },
    [addEvent, bundle.catalog, events, patchRow],
  );

  const updateParty = useCallback(
    (id: string, patch: Partial<PartyRequest>) => {
      const row = rowsRef.current.find((r) => r.kind === "party" && partyCode(r.number) === id);
      if (!row) return;
      const cur = toAdminParty(row);
      const cols: Partial<OrderRow> = {};
      if (patch.status && patch.status !== cur.status) cols.status = PARTY_TO_DB[patch.status];
      if (patch.price !== undefined || patch.deliveryFee !== undefined) {
        const price = patch.price ?? cur.price;
        const fee = patch.deliveryFee ?? cur.deliveryFee;
        const p = parseFloat(price.replace(",", ".")) || 0;
        const f = parseFloat(fee.replace(",", ".")) || 0;
        cols.party = { ...(row.party ?? {}), quote: { price, deliveryFee: fee } };
        cols.subtotal = p;
        cols.delivery_fee = f;
        cols.total = p + f;
      }
      if (patch.proposal !== undefined) cols.proposal = patch.proposal;
      if (Object.keys(cols).length) patchRow(row.id, cols, !!cols.status);
      if (cols.status) void addEvent(row.id, "status", `Estado cambiado a «${PARTY_STATUS[patch.status!][0]}»`);
    },
    [addEvent, patchRow],
  );

  const value = useMemo(() => ({ orders, parties, loaded, updateOrder, updateParty }), [orders, parties, loaded, updateOrder, updateParty]);
  return <OrdersCtx.Provider value={value}>{children}</OrdersCtx.Provider>;
}

/** true cuando los pedidos vienen de la base (no de la demo). */
export function useOrdersFromDb() {
  return useContext(OrdersCtx) !== null;
}

/** Pedidos de la tienda: de la base si hay Supabase; si no, los de ejemplo con los cambios guardados en el navegador. */
export function useOrders(): { orders: AdminOrder[]; update: (id: string, patch: OrderPatch) => void; hydrated: boolean } {
  const ctx = useContext(OrdersCtx);
  const { bundle, demo } = useAdmin();
  const [patches, setPatches, hydrated] = usePersisted<Record<string, OrderPatch>>(dataKey(bundle.tenant.slug, "orders"), {});
  const demoOrders = useMemo(() => demo.orders.map((o) => ({ link: "none", refund: "none", ...o, ...(patches[o.id] ?? {}) })), [demo, patches]);
  const update = useCallback(
    (id: string, patch: OrderPatch) => setPatches((prev) => ({ ...prev, [id]: { ...(prev[id] ?? {}), ...patch } })),
    [setPatches],
  );
  if (ctx) return { orders: ctx.orders, update: ctx.updateOrder, hydrated: ctx.loaded };
  return { orders: demoOrders, update, hydrated };
}

/** Pedidos para fiestas (cotizaciones). Viven dentro de Pedidos. */
export function useParty(): { requests: PartyRequest[]; update: (id: string, patch: Partial<PartyRequest>) => void; hydrated: boolean } {
  const ctx = useContext(OrdersCtx);
  const { bundle, demo } = useAdmin();
  const [patches, setPatches, hydrated] = usePersisted<Record<string, Partial<PartyRequest>>>(dataKey(bundle.tenant.slug, "party"), {});
  const requests = useMemo(() => demo.partyRequests.map((r) => ({ ...r, ...(patches[r.id] ?? {}) })), [demo, patches]);
  const update = useCallback(
    (id: string, patch: Partial<PartyRequest>) => setPatches((prev) => ({ ...prev, [id]: { ...(prev[id] ?? {}), ...patch } })),
    [setPatches],
  );
  if (ctx) return { requests: ctx.parties, update: ctx.updateParty, hydrated: ctx.loaded };
  return { requests, update, hydrated };
}
