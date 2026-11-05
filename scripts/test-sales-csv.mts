// Pruebas del CSV de ventas manuales: npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { parseCsv, parseDay, parseMoney, readSalesCsv, salesToCsv, type Pricer } from "../src/lib/sales/csv.ts";

const catalog = {
  products: [
    { id: "the-squish-box", name: "The Squish Box", variants: [{ id: "unica", label: "Caja completa", price: 69 }] },
    { id: "mini-box-cumple", name: "Mini Box Sorpresa de Cumple", variants: [{ id: "2", label: "2 squishies", price: 18 }, { id: "3", label: "3 squishies", price: 24 }] },
    { id: "mystery-squish", name: "Mystery Squish", variants: [{ id: "unica", label: "1 squishy grande", price: 29 }] },
  ],
};
// Campaña «Cyber» el 2026-11-04: The Squish Box a 59.
const price: Pricer = (pid, vid, day) => {
  const regular = catalog.products.find((p) => p.id === pid)!.variants.find((v) => v.id === vid)!.price;
  return pid === "the-squish-box" && day === "2026-11-04" ? { price: 59, campaignId: "c1", campaign: "Cyber", listPrice: regular } : { price: regular };
};
const opts = { catalog, price, today: "2026-11-05" };

test("montos y fechas", () => {
  assert.equal(parseMoney("S/ 69.00"), 69);
  assert.equal(parseMoney("18,50"), 18.5);
  assert.equal(parseMoney("1,240.50"), 1240.5);
  assert.equal(parseMoney("abc"), null);
  assert.equal(parseDay("2026-11-05"), "2026-11-05");
  assert.equal(parseDay("5/11/2026"), "2026-11-05");
  assert.equal(parseDay("05-11-26"), "2026-11-05");
  assert.equal(parseDay("31/02/2026"), null);
});

test("CSV con comillas, punto y coma y bloque de código de la IA", () => {
  assert.deepEqual(parseCsv('```csv\na;b\n"x;1";"di ""hola"""\n```'), [["a", "b"], ["x;1", 'di "hola"']]);
});

test("agrupa por venta, aplica campaña y precio del día", () => {
  const csv = `fecha,venta,canal,cliente,pago,producto,opcion,cantidad,precio,campana,delivery_cobrado,delivery_costo,nota
2026-11-04,1,instagram,María,yape,the-squish-box,,1,,,10,8,Miraflores
2026-11-04,1,ig,María,yape,Mini Box Sorpresa de Cumple,3 squishies,2,,,,,
2026-11-05,2,feria,,efectivo,mystery,,3,25,,,,`;
  const r = readSalesCsv(csv, opts);
  assert.deepEqual(r.errors, []);
  assert.equal(r.sales.length, 2);
  const [a, b] = r.sales;
  assert.equal(a.channel, "ig");
  assert.equal(a.pay, "Yape");
  assert.equal(a.dIn, 10);
  assert.deepEqual(a.lines[0], { productId: "the-squish-box", variantId: "unica", qty: 1, price: 59, campaignId: "c1", campaign: "Cyber", listPrice: 69 });
  assert.deepEqual(a.lines[1], { productId: "mini-box-cumple", variantId: "3", qty: 2, price: 24 });
  assert.equal(b.lines[0].price, 25); // precio especial: se respeta
  assert.equal(b.lines[0].productId, "mystery-squish");
  // misma entrada → misma referencia (no se duplica al subirla otra vez)
  assert.equal(readSalesCsv(csv, opts).sales[0].ref, a.ref);
});

test("errores por fila", () => {
  const csv = `fecha,canal,producto,opcion,cantidad
2026-11-10,ig,the-squish-box,,1
2026-11-01,web,the-squish-box,,1
2026-11-01,ig,ajolote,,1
2026-11-01,ig,mini-box-cumple,,1
2026-11-01,ig,the-squish-box,,0
2026-11-01,ig,the-squish-box,,2`;
  const r = readSalesCsv(csv, opts);
  assert.deepEqual(r.errors.map((e) => e.row), [2, 3, 4, 5, 6]);
  assert.equal(r.sales.length, 1);
});

test("faltan columnas", () => {
  const r = readSalesCsv("hola,chau\n1,2", opts);
  assert.equal(r.sales.length, 0);
  assert.match(r.errors[0].message, /Faltan las columnas fecha, producto, cantidad/);
});

test("exportar e importar dan las mismas ventas", () => {
  const csv = `fecha,venta,canal,cliente,pago,producto,opcion,cantidad,precio,campana,delivery_cobrado,delivery_costo,nota
2026-11-04,1,ig,"Ana, la de Surco",Plin,the-squish-box,,1,,,10,8,"nota, con coma"`;
  const first = readSalesCsv(csv, opts).sales;
  const out = salesToCsv([...first, { ref: "web-#0012", day: "2026-11-04", channel: "web", client: "", pay: "", lines: [{ productId: "mystery-squish", variantId: "unica", qty: 1, price: 29 }], dIn: 0, dOut: 0, note: "" }], catalog);
  const again = readSalesCsv(out, opts);
  assert.deepEqual(again.errors, []);
  assert.equal(again.warnings.length, 1); // la de la web se salta
  assert.equal(again.sales.length, 1);
  assert.equal(again.sales[0].ref, first[0].ref);
  assert.equal(again.sales[0].client, "Ana, la de Surco");
  assert.deepEqual(again.sales[0].lines, first[0].lines);
});
