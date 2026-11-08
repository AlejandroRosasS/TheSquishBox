"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { dataKey, usePersisted } from "@/lib/admin/storage";
import { EMPTY_INVENTORY, type InventoryData, type Movement, type Supplier, type Supply } from "@/lib/inventory";
import { normalizeRules, recipeKey, type PricingRules, type Quote, type Recipe } from "@/lib/pricing";
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
  /** Devuelve al stock lo que se descontó con una cotización (borra sus salidas). */
  returnQuoteStock: (quoteId: string) => Promise<boolean>;
  savePricing: (r: PricingRules) => Promise<boolean>;
  saveRecipe: (r: Recipe) => Promise<boolean>;
  saveQuote: (q: Quote) => Promise<boolean>;
  deleteQuote: (id: string) => Promise<boolean>;
  /** false si falta la migración 0012 (recetas y cotizaciones). */
  quotesAvailable: boolean;
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

const upsertRecipe = (list: Recipe[], r: Recipe) => [...list.filter((x) => recipeKey(x.product, x.variant) !== recipeKey(r.product, r.variant)), r];
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
      data: { ...EMPTY_INVENTORY, ...data, pricing: normalizeRules(data.pricing) },
      hydrated,
      available: true,
      quotesAvailable: true,
      setEnabled: (enabled) => run((d) => ({ ...d, enabled })),
      saveSupplier: (s) => run((d) => ({ ...d, suppliers: upsertBy(d.suppliers, s) })),
      saveSupply: (s) => run((d) => ({ ...d, supplies: upsertBy(d.supplies, s) })),
      addMovements: (m) => run((d) => ({ ...d, movements: [...d.movements, ...m] })),
      deleteMovement: (id) => run((d) => ({ ...d, movements: d.movements.filter((x) => x.id !== id) })),
      returnQuoteStock: (quoteId) => run((d) => ({ ...d, movements: d.movements.filter((x) => x.quoteId !== quoteId) })),
      savePricing: (pricing) => run((d) => ({ ...d, pricing })),
      saveRecipe: (r) => run((d) => ({ ...d, recipes: upsertRecipe(d.recipes, r) })),
      saveQuote: (q) => run((d) => ({ ...d, quotes: upsertBy(d.quotes, q) })),
      deleteQuote: (id) => run((d) => ({ ...d, quotes: d.quotes.filter((x) => x.id !== id) })),
    }),
    [data, hydrated, run],
  );
}

type SupplierRow = { id: string; name: string; origin: Supplier["origin"]; lead_days: number | null; contact: string | null; note: string | null; archived: boolean };
type SupplyRow = { id: string; name: string; category: string | null; unit: string; purchase_units: Supply["purchaseUnits"] | null; min_stock: number | string | null; shelf_days: number | null; waste_pct: number | string | null; photos: string[] | null; note: string | null; archived: boolean };
type MovementRow = { id: string; supply_id: string; quote_id?: string | null; kind: Movement["kind"]; qty: number | string; amount: number | string | null; supplier_id: string | null; purchase_qty: number | string | null; purchase_unit: string | null; bad_qty: number | string | null; receipt: string | null; note: string | null; happened_on: string; created_at: string };

type RecipeRow = { product: string; variant: string; lines: Recipe["lines"] | null; extra_cost: number | string };
type QuoteRow = { id: string; title: string; client: string | null; lines: Quote["lines"] | null; extra_cost: number | string; cost: number | string; suggested: number | string; price: number | string; valid_until: string | null; status: Quote["status"]; note: string | null; created_at: string };
const recipeFrom = (r: RecipeRow): Recipe => ({ product: r.product, variant: r.variant, lines: r.lines ?? [], extraCost: Number(r.extra_cost ?? 0) });
const quoteFrom = (r: QuoteRow): Quote => ({
  id: r.id, title: r.title, client: r.client ?? "", lines: r.lines ?? [], extraCost: Number(r.extra_cost ?? 0), cost: Number(r.cost), suggested: Number(r.suggested),
  price: Number(r.price), validUntil: r.valid_until, status: r.status, note: r.note ?? "", createdAt: r.created_at,
});
const num = (v: number | string | null | undefined) => (v === null || v === undefined ? undefined : Number(v));
const supplierFrom = (r: SupplierRow): Supplier => ({ id: r.id, name: r.name, origin: r.origin, leadDays: r.lead_days, contact: r.contact ?? "", note: r.note ?? "", archived: r.archived });
const supplyFrom = (r: SupplyRow): Supply => ({
  id: r.id, name: r.name, category: r.category ?? "", unit: r.unit, purchaseUnits: r.purchase_units ?? [], minStock: num(r.min_stock) ?? null, shelfDays: r.shelf_days,
  wastePct: num(r.waste_pct) ?? null, photos: r.photos ?? [], note: r.note ?? "", archived: r.archived,
});
const movementFrom = (r: MovementRow): Movement => ({
  id: r.id, supplyId: r.supply_id, kind: r.kind, qty: Number(r.qty), amount: num(r.amount), supplierId: r.supplier_id ?? undefined, purchaseQty: num(r.purchase_qty),
  purchaseUnit: r.purchase_unit ?? undefined, badQty: num(r.bad_qty), receipt: r.receipt ?? undefined, quoteId: r.quote_id ?? undefined, note: r.note ?? "", day: r.happened_on, createdAt: r.created_at,
});
const missingTable = (e: { code?: string }) => ["PGRST205", "42P01", "PGRST204", "42703"].includes(e.code ?? "");
const MISSING = "El inventario necesita la migración 0011_inventory en Supabase";
const MISSING_12 = "Recetas y cotizaciones necesitan la migración 0012_recipes_quotes en Supabase";
const MISSING_14 = "Descontar stock de una cotización necesita la migración 0014_quote_stock en Supabase";
const MOVEMENT_COLS = "id, supply_id, kind, qty, amount, supplier_id, purchase_qty, purchase_unit, bad_qty, receipt, note, happened_on, created_at";
/** Movimientos con su cotización (0014); si la columna todavía no existe, sin ella. */
async function loadMovements(client: NonNullable<ReturnType<typeof useDb>>["client"], tenantId: string) {
  const q = (cols: string) => client.from("inv_movements").select(cols).eq("tenant_id", tenantId).order("happened_on").order("created_at").limit(20000);
  const first = await q(`${MOVEMENT_COLS}, quote_id`);
  return first.error && ["42703", "PGRST204"].includes(first.error.code ?? "") ? q(MOVEMENT_COLS) : first;
}

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
  const [quotesAvailable, setQuotesAvailable] = useState(true);

  useEffect(() => {
    if (!on || !client || !tenantId) return;
    let alive = true;
    // Parte 2 (0012): si faltan sus tablas, el resto del inventario sigue funcionando.
    void Promise.all([
      client.from("inv_settings").select("pricing").eq("tenant_id", tenantId).maybeSingle(),
      client.from("inv_recipes").select("product, variant, lines, extra_cost").eq("tenant_id", tenantId),
      client.from("inv_quotes").select("id, title, client, lines, extra_cost, cost, suggested, price, valid_until, status, note, created_at").eq("tenant_id", tenantId).order("created_at", { ascending: false }).limit(500),
    ]).then(([pr, rc, qt]) => {
      if (!alive) return;
      const err = pr.error ?? rc.error ?? qt.error;
      if (err) {
        if (missingTable(err)) setQuotesAvailable(false);
        else toast(`No se pudieron cargar recetas y cotizaciones: ${err.message}`);
        return;
      }
      setData((d) => ({
        ...d,
        pricing: normalizeRules((pr.data as { pricing?: unknown } | null)?.pricing),
        recipes: ((rc.data ?? []) as RecipeRow[]).map(recipeFrom),
        quotes: ((qt.data ?? []) as QuoteRow[]).map(quoteFrom),
      }));
    });
    void Promise.all([
      client.from("inv_settings").select("enabled").eq("tenant_id", tenantId).maybeSingle(),
      client.from("inv_suppliers").select("id, name, origin, lead_days, contact, note, archived").eq("tenant_id", tenantId).order("name"),
      client.from("inv_supplies").select("id, name, category, unit, purchase_units, min_stock, shelf_days, waste_pct, photos, note, archived").eq("tenant_id", tenantId).order("name"),
      loadMovements(client, tenantId),
    ]).then(([st, su, sp, mv]) => {
      if (!alive) return;
      const err = st.error ?? su.error ?? sp.error ?? mv.error;
      if (err) {
        if (missingTable(err)) setAvailable(false);
        else toast(`No se pudo cargar el inventario: ${err.message}`);
      } else {
        setData((d) => ({
          ...d,
          enabled: !!st.data?.enabled,
          suppliers: ((su.data ?? []) as SupplierRow[]).map(supplierFrom),
          supplies: ((sp.data ?? []) as SupplyRow[]).map(supplyFrom),
          movements: ((mv.data ?? []) as unknown as MovementRow[]).map(movementFrom),
        }));
      }
      setHydrated(true);
    });
    return () => {
      alive = false;
    };
  }, [on, client, tenantId, toast]);

  const guard = useCallback(async (label: string, f: () => PromiseLike<{ error: { message: string; code?: string } | null }>, part2 = false) => {
    if (!client || !tenantId || !userId) {
      toast("Ingresa al panel para guardar");
      return false;
    }
    if (!available || (part2 && !quotesAvailable)) {
      toast(part2 && available ? MISSING_12 : MISSING);
      return false;
    }
    const { error } = await f();
    if (error) {
      const gone = missingTable(error);
      if (gone && part2) setQuotesAvailable(false);
      else if (gone) setAvailable(false);
      toast(gone ? (part2 ? MISSING_12 : MISSING) : `No se pudo guardar ${label}: ${error.message}`);
      return false;
    }
    return true;
  }, [client, tenantId, userId, available, quotesAvailable, toast]);

  return useMemo<InventoryState>(() => ({
    data,
    hydrated,
    available,
    quotesAvailable,
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
      const rows = list.map((m) => ({
        id: m.id, tenant_id: tenantId, supply_id: m.supplyId, kind: m.kind, qty: m.qty, amount: m.amount ?? null, supplier_id: m.supplierId ?? null,
        purchase_qty: m.purchaseQty ?? null, purchase_unit: m.purchaseUnit ?? null, bad_qty: m.badQty ?? null, receipt: m.receipt ?? null,
        note: m.note || null, happened_on: m.day, created_at: m.createdAt, created_by: userId, ...(m.quoteId ? { quote_id: m.quoteId } : {}),
      }));
      // Salidas por cotización (0014): si falta la migración, avisa sin apagar el resto del inventario.
      if (list.some((m) => m.kind === "sale")) {
        if (!client || !tenantId || !userId) {
          toast("Ingresa al panel para guardar");
          return false;
        }
        const { error } = await client.from("inv_movements").insert(rows);
        if (error) {
          toast(["42703", "PGRST204", "23514"].includes(error.code ?? "") ? MISSING_14 : `No se pudo descontar el stock: ${error.message}`);
          return false;
        }
        setData((d) => ({ ...d, movements: [...d.movements, ...list] }));
        return true;
      }
      const ok = await guard("el movimiento", () => client!.from("inv_movements").insert(rows));
      if (ok) setData((d) => ({ ...d, movements: [...d.movements, ...list] }));
      return ok;
    },
    deleteMovement: async (id) => {
      const ok = await guard("el cambio", () => client!.from("inv_movements").delete().eq("tenant_id", tenantId).eq("id", id));
      if (ok) setData((d) => ({ ...d, movements: d.movements.filter((m) => m.id !== id) }));
      return ok;
    },
    returnQuoteStock: async (quoteId) => {
      const ok = await guard("el cambio", () => client!.from("inv_movements").delete().eq("tenant_id", tenantId).eq("quote_id", quoteId));
      if (ok) setData((d) => ({ ...d, movements: d.movements.filter((m) => m.quoteId !== quoteId) }));
      return ok;
    },
    savePricing: async (pricing) => {
      const ok = await guard("las reglas de precio", () => client!.from("inv_settings").upsert({ tenant_id: tenantId, enabled: data.enabled, pricing, updated_at: new Date().toISOString(), updated_by: userId }), true);
      if (ok) setData((d) => ({ ...d, pricing }));
      return ok;
    },
    saveRecipe: async (r) => {
      const ok = await guard("la receta", () => client!.from("inv_recipes").upsert({ tenant_id: tenantId, product: r.product, variant: r.variant, lines: r.lines, extra_cost: r.extraCost, updated_at: new Date().toISOString(), updated_by: userId }), true);
      if (ok) setData((d) => ({ ...d, recipes: upsertRecipe(d.recipes, r) }));
      return ok;
    },
    saveQuote: async (q) => {
      const ok = await guard("la cotización", () => client!.from("inv_quotes").upsert({
        id: q.id, tenant_id: tenantId, title: q.title, client: q.client || null, lines: q.lines, extra_cost: q.extraCost, cost: q.cost, suggested: q.suggested,
        price: q.price, valid_until: q.validUntil, status: q.status, note: q.note || null, created_at: q.createdAt, created_by: userId,
      }), true);
      if (ok) setData((d) => ({ ...d, quotes: upsertBy(d.quotes, q) }));
      return ok;
    },
    deleteQuote: async (id) => {
      const ok = await guard("el cambio", () => client!.from("inv_quotes").delete().eq("tenant_id", tenantId).eq("id", id), true);
      if (ok) setData((d) => ({ ...d, quotes: d.quotes.filter((q) => q.id !== id) }));
      return ok;
    },
  }), [data, hydrated, available, quotesAvailable, guard, client, tenantId, userId, toast]);
}
