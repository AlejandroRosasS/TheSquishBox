import { test } from "node:test";
import assert from "node:assert/strict";
import { deductions, normalizeFees, payMethodKey, DEFAULT_FEES } from "../src/lib/sales/fees.ts";

test("medio de pago → regla", () => {
  assert.equal(payMethodKey("tarjeta", "web"), "card_web");
  assert.equal(payMethodKey("Tarjeta (POS)", "feria"), "card_pos");
  assert.equal(payMethodKey("Tarjeta", "ig"), "card_pos");
  assert.equal(payMethodKey("yape", "web"), "yape");
  assert.equal(payMethodKey("Efectivo", "feria"), "efectivo");
  assert.equal(payMethodKey("", "feria"), null);
});

test("IGV y comisión", () => {
  const d = deductions(118, { igv: true, pct: 4, fixed: 0.5 }, 18, true);
  assert.equal(d.igv, 18);
  assert.equal(d.fee, 5.22);
  assert.deepEqual(deductions(118, { igv: true, pct: 4, fixed: 0.5 }, 18, false).fee, 4.72);
  assert.deepEqual(deductions(100, DEFAULT_FEES.rules.yape, 18, true), { igv: 0, fee: 0 });
});

test("normalizar lo guardado", () => {
  const f = normalizeFees({ igvRate: "18", rules: { card_pos: { igv: true, pct: "3.5" }, yape: { pct: -1 } } });
  assert.equal(f.rules.card_pos.pct, 3.5);
  assert.equal(f.rules.yape.pct, 0);
  assert.equal(f.rules.card_web.igv, true);
  assert.equal(normalizeFees(null).igvRate, 18);
});
