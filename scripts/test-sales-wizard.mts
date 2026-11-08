// Pruebas de la venta paso a paso de Telegram (/vta): npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { addLine, fitTotal, linesTotal } from "../src/lib/sales/wizard.ts";

const box = { productId: "box", variantId: "std", qty: 1, price: 69 };
const mini = { productId: "mini", variantId: "3", qty: 2, price: 24 };

test("mismo monto que la web: no cambia nada (ni la campaña)", () => {
  const camp = { ...box, price: 59, campaignId: "c1", campaign: "Cyber", listPrice: 69 };
  assert.deepEqual(fitTotal([camp], 59), [camp]);
});

test("otro monto se reparte en proporción y suma exacto", () => {
  const out = fitTotal([box, mini], 100); // web 117
  assert.equal(linesTotal(out), 100);
  assert.ok(out.every((l) => !("campaignId" in l)));
  assert.equal(out.reduce((a, l) => a + l.qty, 0), 3);
});

test("centavo que no se reparte parejo: una unidad aparte", () => {
  const out = fitTotal([{ ...mini, qty: 3 }], 70); // 3 x 23.33 = 69.99
  assert.equal(linesTotal(out), 70);
  assert.deepEqual(out.map((l) => l.qty), [2, 1]);
});

test("mismo producto dos veces se junta", () => {
  const lines = addLine(addLine([], mini), { ...mini, qty: 3 });
  assert.equal(lines.length, 1);
  assert.equal(lines[0].qty, 5);
});
