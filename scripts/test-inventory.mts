// Pruebas del inventario (stock y costo promedio ponderado): npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { purchaseMovement, supplyState, unitsLabel, type Movement, type Supply } from "../src/lib/inventory.ts";

const rosa: Supply = { id: "r", name: "Rosa roja", category: "Flor", unit: "tallo", purchaseUnits: [{ name: "paquete", factor: 25 }], minStock: 50, shelfDays: 7, wastePct: 8, photos: [], note: "", archived: false };
let n = 0;
const ids = () => ({ id: String(++n), createdAt: `2026-11-07T00:00:0${n}Z` });
const buy = (qty: number, unitName: string, amount: number, day: string, supplierId?: string, badQty = 0) => {
  const m = purchaseMovement({ supply: rosa, purchaseQty: qty, unitName, badQty, amount, supplierId, day, note: "" }, ids());
  assert.equal(typeof m, "object");
  return m as Movement;
};

test("la merma al recibir queda dentro del costo promedio (ejemplo del doc)", () => {
  const mv = [buy(40, "tallo", 80, "2026-11-01", "shane"), buy(4, "paquete", 300, "2026-11-03", "galdias", 8)];
  const st = supplyState(rosa, mv, "2026-11-07");
  assert.equal(st.stock, 132);
  assert.equal(st.avgCost, 2.88); // (80 + 300) / (40 + 92)
  assert.equal(st.last?.supplierId, "galdias");
});

test("compra de emergencia más cara sube el promedio y se ve por proveedor", () => {
  const mv = [buy(50, "tallo", 250, "2026-11-01", "shane"), { ...ids(), supplyId: "r", kind: "use", qty: -40, note: "", day: "2026-11-02" } as Movement, buy(20, "tallo", 240, "2026-11-03", "galdias")];
  const st = supplyState(rosa, mv, "2026-11-07");
  assert.equal(st.stock, 30);
  assert.equal(st.avgCost, 9.67); // (10 × 5 + 240) / 30
  assert.equal(st.low, true);
  const bySup = Object.fromEntries(st.bySupplier.map((s) => [s.supplierId, s.last.unitCost]));
  assert.deepEqual(bySup, { shane: 5, galdias: 12 });
});

test("merma posterior sale al costo promedio sin cambiarlo", () => {
  const mv = [buy(100, "tallo", 300, "2026-11-01"), { ...ids(), supplyId: "r", kind: "waste", qty: -10, note: "", day: "2026-11-05" } as Movement];
  const st = supplyState(rosa, mv, "2026-11-07");
  assert.equal(st.stock, 90);
  assert.equal(st.avgCost, 3);
  assert.equal(st.wasteValue30, 30);
});

test("validaciones de la compra", () => {
  assert.equal(typeof purchaseMovement({ supply: rosa, purchaseQty: 1, unitName: "caja", badQty: 0, amount: 10, day: "2026-11-01", note: "" }, ids()), "string");
  assert.equal(typeof purchaseMovement({ supply: rosa, purchaseQty: 1, unitName: "paquete", badQty: 30, amount: 10, day: "2026-11-01", note: "" }, ids()), "string");
});

test("plural de unidades", () => {
  assert.equal(unitsLabel(12, "tallo"), "12 tallos");
  assert.equal(unitsLabel(1, "tallo"), "1 tallo");
  assert.equal(unitsLabel(3, "pliego"), "3 pliegos");
  assert.equal(unitsLabel(2, "unidad"), "2 unidades");
});
