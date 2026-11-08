// Pruebas del cotizador (costo de receta, precio sugerido, redondeo): npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { costOf, realMargin, roundPrice, suggestedPrice, DEFAULT_RULES } from "../src/lib/pricing.ts";
import type { Supply } from "../src/lib/inventory.ts";

const sup = (id: string, wastePct: number | null): Supply => ({ id, name: id, category: "", unit: "u", purchaseUnits: [], minStock: null, shelfDays: null, wastePct, photos: [], note: "", archived: false });
const supplies = new Map([sup("rosa", 10), sup("papel", 0), sup("florero", 0)].map((s) => [s.id, s]));
const avg: Record<string, number> = { rosa: 2.88, papel: 1.2, florero: 15 };

test("costo de receta con merma y opcionales", () => {
  const lines = [{ supply: "rosa", qty: 12 }, { supply: "papel", qty: 3 }, { supply: "florero", qty: 1, optional: "Con florero" }];
  const sin = costOf(lines, supplies, (id) => avg[id], { extra: 1 });
  assert.equal(sin.supplies, 38.16); // 34.56 + 3.60
  assert.equal(sin.waste, 3.46); // 10 % de las rosas
  assert.equal(sin.total, 42.62);
  const con = costOf(lines, supplies, (id) => avg[id], { extra: 1, withOptionals: ["Con florero"] });
  assert.equal(con.total, 57.62);
});

test("precio sugerido del doc: costo 58.71, margen 50 %, terminar en 9 → 119", () => {
  const r = suggestedPrice(58.71, { ...DEFAULT_RULES, margin: 50, rounding: "9" });
  assert.equal(r.base, 117.42);
  assert.equal(r.price, 119);
});

test("multiplicador e IGV", () => {
  assert.equal(suggestedPrice(10, { mode: "multiplier", margin: 0, multiplier: 3, rounding: "none", igv: false }).price, 30);
  assert.equal(suggestedPrice(10, { mode: "multiplier", margin: 0, multiplier: 3, rounding: "none", igv: true }).price, 35.4);
  assert.equal(realMargin(35.4, 10, { igv: true }), 66.7);
});

test("redondeo hacia arriba", () => {
  assert.equal(roundPrice(117.42, "sol"), 118);
  assert.equal(roundPrice(117.42, "9"), 119);
  assert.equal(roundPrice(119.5, "9"), 129);
  assert.equal(roundPrice(119, "9"), 119);
  assert.equal(roundPrice(117.42, "10"), 120);
  assert.equal(roundPrice(120, "10"), 120);
});

test("insumos de una cotización: recetas por cantidad, opcionales elegidos e insumos sueltos", async () => {
  const { quoteSupplies } = await import("../src/lib/pricing.ts");
  const recipes = [{ product: "ramo", variant: "u", extraCost: 2, lines: [{ supply: "rosa", qty: 6 }, { supply: "papel", qty: 2 }, { supply: "florero", qty: 1, optional: "Con florero" }] }];
  const r = (p: string, v: string) => recipes.find((x) => x.product === p && x.variant === v);
  const q = quoteSupplies([
    { kind: "recipe", product: "ramo", variant: "u", name: "Ramo", qty: 3, optionals: [] },
    { kind: "recipe", product: "ramo", variant: "u", name: "Ramo", qty: 2, optionals: ["Con florero"] },
    { kind: "supply", supply: "rosa", name: "Rosa", qty: 4 },
    { kind: "recipe", product: "borrado", variant: "u", name: "Sin receta", qty: 5, optionals: [] },
  ], r);
  assert.deepEqual(q.supplies, [{ supply: "rosa", qty: 34 }, { supply: "papel", qty: 10 }, { supply: "florero", qty: 2 }]);
  assert.equal(q.extra, 10);
});
