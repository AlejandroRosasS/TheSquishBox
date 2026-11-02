// Pruebas del lector de captions: node --experimental-strip-types scripts/test-caption.mts
import assert from "node:assert/strict";
import { test } from "node:test";
import { parseAmount, parseCaption } from "../src/lib/instagram/caption.ts";

const lines = [
  { id: "cumple", name: "Cumpleaños" },
  { id: "recompra", name: "Recompra" },
  { id: "mystery", name: "Cajas Mystery" },
];

test("montos", () => {
  assert.equal(parseAmount("18"), 18);
  assert.equal(parseAmount("18,50"), 18.5);
  assert.equal(parseAmount("1,200"), 1200);
  assert.equal(parseAmount("0"), null);
});

test("precio único", () => {
  const s = parseCaption("✨ Mystery Squish ✨\nUn squishy sorpresa en su sobre.\nPrecio: S/ 12.00 💖 #squishy #peru", lines);
  assert.equal(s.name, "Mystery Squish");
  assert.equal(s.price, 12);
  assert.deepEqual(s.variants, []);
  assert.equal(s.line, "mystery");
  assert.equal(s.kind, "new");
  assert.deepEqual(s.hashtags, ["squishy", "peru"]);
});

test("opciones con precio, una por línea", () => {
  const s = parseCaption("Mini Box Sorpresa de Cumple 🎂\n• 2 squishies: S/18\n• 3 squishies: S/.24\nHaz tu pedido por DM", lines);
  assert.equal(s.name, "Mini Box Sorpresa de Cumple");
  assert.equal(s.price, null);
  assert.deepEqual(s.variants, [{ label: "2 squishies", price: 18 }, { label: "3 squishies", price: 24 }]);
  assert.equal(s.line, "cumple");
});

test("precio en soles", () => {
  assert.equal(parseCaption("Llavero fresa a 15 soles").price, 15);
});

test("opciones sin precio: no se inventa", () => {
  const s = parseCaption("Nuestra nueva Caja de Recompra. Disponible con 4 o 5 squishies pequeños, cada uno en su sobre…", lines);
  assert.deepEqual(s.variants, [{ label: "4 squishies", price: null }, { label: "5 squishies", price: null }]);
  assert.equal(s.price, null);
  assert.equal(s.line, "recompra");
});

test("precios distintos sin etiqueta: sin precio", () => {
  const s = parseCaption("Antes S/ 30 ahora S/ 25");
  assert.equal(s.price, null);
});

test("contenido", () => {
  assert.equal(parseCaption("🎉 SORTEO 🎉 Sigue a la cuenta y etiqueta a 2 amigas").kind, "content");
  assert.equal(parseCaption("Conoce las Patitas 🐾").kind, "content");
  assert.equal(parseCaption("").name, "");
});
