"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { dataKey, usePersisted } from "@/lib/admin/storage";
import { EMPTY_INVENTORY, type InventoryData, type Movement, type Supplier, type Supply } from "@/lib/inventory";
import { useAdmin } from "./AdminContext";
import { useDb } from "./DbContext";

export type InventoryState = {
  data: InventoryData;
  hydrated: boolean;
  /** false si la base aún no tiene las tablas (falta la migración 0011_inventory). */
  available: boolean;
  setEnabled: (on: boolean) => Promise<boolean>;
  saveSupplier: (s: Supplier) => Promise<boolean>;
  saveSupply: (s: Supply) => Promise<boolean>;
  addMovements: (m: Movement[]) => Promise<boolean>;
  deleteMovement: (id: string) => Promise<boolean>;
};

const Ctx = createContext<InventoryState | null>(null);

export function useInventory(): InventoryState {
  const v = useContext(Ctx);
  if (!v) throw new Error("useInventory fuera de InventoryProvider");
  return v;
}

/** Inventario de la marca: en la base con Supabase; en el navegador en modo demo. */
export function InventoryProvider({ children }: { children: ReactNode }) {
  const db = useDb();
  const local = useLocalInventory(!db);
  const remote = useDbInventory(!!db);
  return <Ctx.Provider value={db ? remote : local}>{children}</Ctx.Provider>;
}

const upsertBy = <T extends { id: string }>(list: T[], item: T) => (list.some((x) => x.id === item.id) ? list.map((x) => (x.id === item.id ? item : x)) : [...list, item]);

function useLocalInventory(on: boolean): InventoryState {
  const { bundle } = useAdmin();
  const [data, set, hydrated] = usePersisted<InventoryData>(dataKey(bundle.tenant.slug, "inventory"), EMPTY_INVENTORY);
  const run = useCallback(
    async (f: (d: InventoryData) => InventoryData) => {
      if (on) set((d) => f({ ...EMPTY_INVENTORY, ...d }));
      return true;
    },
    [on, set],
  );
  return useMemo(
    () => ({
      data: { ...EMPTY_INVENTORY, ...data },
      hydrated,
      available: true,
      setEnabled: (enabled) => run((d) => ({ ...d, enabled })),
      saveSupplier: (s) => run((d) => ({ ...d, suppliers: upsertBy(d.suppliers, s) })),
      saveSupply: (s) => run((d) => ({ ...d, supplies: upsertBy(d.supplies, s) })),
      addMovements: (m) => run((d) => ({ ...d, movements: [...d.movements, ...m] })),
      deleteMovement: (id) => run((d) => ({ ...d, movements: d.movements.filter((x) => x.id !== id) })),
    }),
    [data, hydrated, run],
  );
}

type SupplierRow = { id: string; name: string; origin: Supplier["origin"]; lead_days: number | null; contact: string | null; note: string | null; archived: boolean };
type SupplyRow = { id: string; name: string; category: string | null; unit: string; purchase_units: Supply["purchaseUnits"] | null; min_stock: number | string | null; shelf_days: number | null; waste_pct: number | string | null; photos: string[] | null; note: string | null; archived: boolean };
type MovementRow = { id: string; supply_id: string; kind: Movement["kind"]; qty: number | string; amount: number | string | null; supplier_id: string | null; purchase_qty: number | string | null; purchase_unit: string | null; bad_qty: number | string | null; receipt: string | null; note: string | null; happened_on: string; created_at: string };

const num = (v: number | string | null | undefined) => (v === null || v === undefined ? undefined : Number(v));
const supplierFrom = (r: SupplierRow): Supplier => ({ id: r.id, name: r.name, origin: r.origin, leadDays: r.lead_days, contact: r.contact ?? "", note: r.note ?? "", archived: r.archived });
const supplyFrom = (r: SupplyRow): Supply => ({
  id: r.id, name: r.name, category: r.category ?? "", unit: r.unit, purchaseUnits: r.purchase_units ?? [], minStock: num(r.min_stock) ?? null, shelfDays: r.shelf_days,
  wastePct: num(r.waste_pct) ?? null, photos: r.photos ?? [], note: r.note ?? "", archived: r.archived,
});
const movementFrom = (r: MovementRow): Movement => ({
  id: r.id, supplyId: r.supply_id, kind: r.kind, qty: Number(r.qty), amount: num(r.amount), supplierId: r.supplier_id ?? undefined, purchaseQty: num(r.purchase_qty),
  purchaseUnit: r.purchase_unit ?? undefined, badQty: num(r.bad_qty), receipt: r.receipt ?? undefined, note: r.note ?? "", day: r.happened_on, createdAt: r.created_at,
});
const missingTable = (e: { code?: string }) => ["PGRST205", "42P01", "PGRST204", "42703"].includes(e.code ?? "");
const MISSING = "El inventario necesita la migración 0011_inventory en Supabase";

function useDbInventory(on: boolean): InventoryState {
  const db = useDb();
  const { toast } = useAdmin();
  const ready = db?.state.phase === "ready" ? db.state : null;
  const tenantId = ready?.tenantId;
  const userId = ready?.user.id;
  const client = db?.client;
  const [data, setData] = useState<InventoryData>(EMPTY_INVENTORY);
  const [hydrated, setHydrated] = useState(false);
  const [available, setAvailable] = useState(true);

  useEffect(() => {
    if (!on || !client || !tenantId) return;
    let alive = true;
    void Promise.all([
      client.from("inv_settings").select("enabled").eq("tenant_id", tenantId).maybeSingle(),
      client.from("inv_suppliers").select("id, name, origin, lead_days, contact, note, archived").eq("tenant_id", tenantId).order("name"),
      client.from("inv_supplies").select("id, name, category, unit, purchase_units, min_stock, shelf_days, waste_pct, photos, note, archived").eq("tenant_id", tenantId).order("name"),
      client.from("inv_movements").select("id, supply_id, kind, qty, amount, supplier_id, purchase_qty, purchase_unit, bad_qty, receipt, note, happened_on, created_at").eq("tenant_id", tenantId).order("happened_on").order("created_at").limit(20000),
    ]).then(([st, su, sp, mv]) => {
      if (!alive) return;
      const err = st.error ?? su.error ?? sp.error ?? mv.error;
      if (err) {
        if (missingTable(err)) setAvailable(false);
        else toast(`No se pudo cargar el inventario: ${err.message}`);
      } else {
        setData({
          enabled: !!st.data?.enabled,
          suppliers: ((su.data ?? []) as SupplierRow[]).map(supplierFrom),
          supplies: ((sp.data ?? []) as SupplyRow[]).map(supplyFrom),
          movements: ((mv.data ?? []) as MovementRow[]).map(movementFrom),
        });
      }
      setHydrated(true);
    });
    return () => {
      alive = false;
    };
  }, [on, client, tenantId, toast]);

  const guard = useCallback(async (label: string, f: () => PromiseLike<{ error: { message: string; code?: string } | null }>) => {
    if (!client || !tenantId || !userId) {
      toast("Ingresa al panel para guardar");
      return false;
    }
    if (!available) {
      toast(MISSING);
      return false;
    }
    const { error } = await f();
    if (error) {
      if (missingTable(error)) setAvailable(false);
      toast(missingTable(error) ? MISSING : `No se pudo guardar ${label}: ${error.message}`);
      return false;
    }
    return true;
  }, [client, tenantId, userId, available, toast]);

  return useMemo<InventoryState>(() => ({
    data,
    hydrated,
    available,
    setEnabled: async (enabled) => {
      const ok = await guard("el ajuste", () => client!.from("inv_settings").upsert({ tenant_id: tenantId, enabled, updated_at: new Date().toISOString(), updated_by: userId }));
      if (ok) setData((d) => ({ ...d, enabled }));
      return ok;
    },
    saveSupplier: async (s) => {
      const ok = await guard("el proveedor", () => client!.from("inv_suppliers").upsert({ id: s.id, tenant_id: tenantId, name: s.name, origin: s.origin, lead_days: s.leadDays, contact: s.contact || null, note: s.note || null, archived: s.archived }));
      if (ok) setData((d) => ({ ...d, suppliers: upsertBy(d.suppliers, s) }));
      return ok;
    },
    saveSupply: async (s) => {
      const ok = await guard("el insumo", () => client!.from("inv_supplies").upsert({
        id: s.id, tenant_id: tenantId, name: s.name, category: s.category || null, unit: s.unit, purchase_units: s.purchaseUnits, min_stock: s.minStock,
        shelf_days: s.shelfDays, waste_pct: s.wastePct, photos: s.photos, note: s.note || null, archived: s.archived,
      }));
      if (ok) setData((d) => ({ ...d, supplies: upsertBy(d.supplies, s) }));
      return ok;
    },
    addMovements: async (list) => {
      const ok = await guard("el movimiento", () => client!.from("inv_movements").insert(list.map((m) => ({
        id: m.id, tenant_id: tenantId, supply_id: m.supplyId, kind: m.kind, qty: m.qty, amount: m.amount ?? null, supplier_id: m.supplierId ?? null,
        purchase_qty: m.purchaseQty ?? null, purchase_unit: m.purchaseUnit ?? null, bad_qty: m.badQty ?? null, receipt: m.receipt ?? null,
        note: m.note || null, happened_on: m.day, created_at: m.createdAt, created_by: userId,
      }))));
      if (ok) setData((d) => ({ ...d, movements: [...d.movements, ...list] }));
      return ok;
    },
    deleteMovement: async (id) => {
      const ok = await guard("el cambio", () => client!.from("inv_movements").delete().eq("tenant_id", tenantId).eq("id", id));
      if (ok) setData((d) => ({ ...d, movements: d.movements.filter((m) => m.id !== id) }));
      return ok;
    },
  }), [data, hydrated, available, guard, client, tenantId, userId]);
}
