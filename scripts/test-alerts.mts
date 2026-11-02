// Pruebas de la configuración de alertas: npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { normalizeConfig, parseRecipient } from "../src/lib/alerts/config.ts";

test("celular peruano de 9 dígitos agrega 51", () => {
  assert.deepEqual(parseRecipient("whatsapp", "987 654 321"), { to: "51987654321", label: "+51 987 654 321" });
  assert.deepEqual(parseRecipient("whatsapp", "+51 987-654-321"), { to: "51987654321", label: "+51 987 654 321" });
});

test("números y correos inválidos", () => {
  assert.ok("error" in parseRecipient("whatsapp", "12345"));
  assert.ok("error" in parseRecipient("email", "ana@"));
  assert.deepEqual(parseRecipient("email", " Ana@Correo.com "), { to: "ana@correo.com", label: "ana@correo.com" });
});

test("configuración vacía o incompleta queda completa y apagada", () => {
  const c = normalizeConfig(null);
  assert.equal(c.channels.telegram.on, false);
  assert.deepEqual(c.events, { order_new: true, party_new: true });
  const d = normalizeConfig({ channels: { email: { on: true, recipients: [{ to: "a@b.co" }, { to: "" }] } }, events: { party_new: false } });
  assert.deepEqual(d.channels.email, { on: true, recipients: [{ to: "a@b.co", label: "a@b.co" }] });
  assert.equal(d.events.party_new, false);
  assert.equal(d.events.order_new, true);
});
