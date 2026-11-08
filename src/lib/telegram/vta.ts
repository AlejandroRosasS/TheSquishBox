import type { SupabaseClient } from "@supabase/supabase-js";
import { telegram } from "@/lib/alerts/channels";
import { formatPrice } from "@/lib/format";
import { fingerprint, parseMoney, type CatalogLite, type SaleDraft, type SaleLineDraft } from "@/lib/sales/csv";
import { limaToday, makePricer } from "@/lib/sales/pricer";
import { saleRow } from "@/lib/sales/rows";
import { salesContext } from "@/lib/sales/server";
import { addLine, fitTotal, linesTotal, WIZARD_CHANNELS, WIZARD_PAYS } from "@/lib/sales/wizard";
import { tenantsOfChat, type TgChat } from "@/lib/telegram/bot";

/**
 * /vta: registrar una venta con botones (canal → pago → productos y cantidades → monto).
 * Mientras se arma, la venta vive en `sales_imports` (status pending, un solo elemento en `sales`
 * con el campo `wizard`): así no hace falta otra tabla y el webhook sigue sin estado.
 * Cada paso edita el mismo mensaje del bot; solo el monto o una cantidad «otra» se escriben.
 */

type Step = "canal" | "pago" | "items" | "cantidad" | "cantidad_txt" | "total" | "total_txt";
type Wizard = { step: Step; page: number; pick?: { productId: string; variantId: string }; total?: number; msgId?: number; askId?: number };
type Draft = SaleDraft & { wizard: Wizard };
type Tenant = { id: string; name: string };
type Row = { id: string; tenant_id: string; chat_id: string; sales: Draft[]; status: string; created_at: string };
export type TgMessage = { message_id: number; chat: TgChat; from?: { first_name?: string }; text?: string; reply_to_message?: { message_id: number } };
export type TgCallback = { id: string; from: { first_name?: string }; data?: string; message?: TgMessage };

const PAGE = 8;
const EXPIRES_MS = 2 * 86_400_000;
const MAX_TOTAL = 100_000;

const dayShort = (day: string) => `${+day.slice(8, 10)}/${+day.slice(5, 7)}`;
const label = (list: [string, string][], key?: string) => list.find((x) => x[0] === key)?.[1] ?? key ?? "";

type Option = { productId: string; variantId: string; name: string; price: number; campaign?: string };
function options(catalog: CatalogLite, price: ReturnType<typeof makePricer>, day: string): Option[] {
  return catalog.products.flatMap((p) =>
    p.variants.map((v) => {
      const d = price(p.id, v.id, day);
      return { productId: p.id, variantId: v.id, name: `${p.name}${p.variants.length > 1 ? ` · ${v.label}` : ""}`, price: d.price, campaign: d.campaign };
    }),
  );
}
const lineName = (catalog: CatalogLite, l: Pick<SaleLineDraft, "productId" | "variantId">) => {
  const p = catalog.products.find((x) => x.id === l.productId);
  if (!p) return l.productId;
  return `${p.name}${p.variants.length > 1 ? ` (${p.variants.find((v) => v.id === l.variantId)?.label ?? l.variantId})` : ""}`;
};
const cut = (s: string, n = 56) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

type Button = { text: string; callback_data: string };
type View = { text: string; keyboard: Button[][] };

function render(d: Draft, brand: string, catalog: CatalogLite, opts: Option[]): View {
  const w = d.wizard;
  const id = d.ref; // los botones llevan el id de la importación, guardado en ref hasta registrar
  const b = (text: string, action: string): Button => ({ text, callback_data: `v:${id}:${action}` });
  const cancel = b("✖️ Cancelar", "x");
  const web = linesTotal(d.lines);
  const head = [`🧾 Nueva venta de ${brand} · hoy ${dayShort(d.day)}`];
  if (d.channel) head.push(`Canal: ${label(WIZARD_CHANNELS, d.channel)}`);
  if (d.pay) head.push(`Pago: ${label(WIZARD_PAYS, d.pay)}`);
  if (d.lines.length) {
    head.push("", "Productos:");
    for (const l of d.lines) head.push(`• ${lineName(catalog, l)} x${l.qty} · ${formatPrice(l.price * l.qty)}${l.campaign ? ` (campaña ${l.campaign})` : ""}`);
    head.push(`Total según la web: ${formatPrice(web)}`);
  }
  const ask = (q: string, keyboard: Button[][]): View => ({ text: [...head, "", q].join("\n"), keyboard });

  switch (w.step) {
    case "canal":
      return ask("¿Dónde fue la venta?", [WIZARD_CHANNELS.map(([k, t]) => b(t, `c:${k}`)), [cancel]]);
    case "pago":
      return ask("¿Cómo pagó?", [WIZARD_PAYS.map(([, t], i) => b(t, `p:${i}`)), [b("↩️ Atrás", "back"), cancel]]);
    case "items": {
      const pages = Math.max(1, Math.ceil(opts.length / PAGE));
      const page = Math.min(w.page, pages - 1);
      const rows: Button[][] = opts.slice(page * PAGE, page * PAGE + PAGE).map((o, i) => [b(cut(`${o.name} · ${formatPrice(o.price)}`), `i:${page * PAGE + i}`)]);
      if (pages > 1) rows.push([b("◀️", `pg:${(page + pages - 1) % pages}`), b(`${page + 1}/${pages}`, `pg:${page}`), b("▶️", `pg:${(page + 1) % pages}`)]);
      if (d.lines.length) rows.push([b("↩️ Quitar el último", "del"), b(`✅ Listo · ${formatPrice(web)}`, "done")]);
      else rows.push([b("↩️ Atrás", "back")]);
      rows.push([cancel]);
      if (!opts.length) return ask("No hay productos publicados en la web. Agrégalos en el panel (Productos) y vuelve a intentar.", [[cancel]]);
      return ask(d.lines.length ? "¿Algo más? Elige otro producto o toca «Listo»." : "¿Qué producto se llevó? Puedes agregar varios.", rows);
    }
    case "cantidad": {
      const o = opts.find((x) => x.productId === w.pick?.productId && x.variantId === w.pick?.variantId);
      return ask(`¿Cuántas unidades de ${o?.name ?? "ese producto"}?`, [
        [1, 2, 3, 4, 5].map((n) => b(String(n), `q:${n}`)),
        [b("Otra cantidad", "qx")],
        [b("↩️ Atrás", "back"), cancel],
      ]);
    }
    case "cantidad_txt":
      return ask("Escríbeme la cantidad (solo el número).", [[b("↩️ Atrás", "back"), cancel]]);
    case "total": {
      const total = w.total ?? web;
      const rows: Button[][] = [[b(`✅ Registrar con ${formatPrice(total)}`, "ok")], [b("✏️ Otro monto", "t")]];
      if (w.total !== undefined && w.total !== web) rows.push([b(`Usar el precio web (${formatPrice(web)})`, "tw")]);
      rows.push([b("↩️ Agregar más productos", "back"), cancel]);
      const q = w.total !== undefined && w.total !== web ? `Monto cobrado: ${formatPrice(total)}. ¿Lo registro?` : `¿Cobraste ${formatPrice(web)}? Si fue otro monto (descuento, redondeo), toca «Otro monto».`;
      return ask(q, rows);
    }
    case "total_txt":
      return ask("Escríbeme el monto total que cobraste, por ejemplo 65 o 65.50.", [[b("↩️ Atrás", "back"), cancel]]);
  }
}

async function load(db: SupabaseClient, id: string): Promise<Row | null> {
  const { data } = await db.from("sales_imports").select("id, tenant_id, chat_id, sales, status, created_at").eq("id", id).maybeSingle();
  const row = data as Row | null;
  return row && Array.isArray(row.sales) && row.sales[0]?.wizard ? row : null;
}
const store = (db: SupabaseClient, id: string, d: Draft) => db.from("sales_imports").update({ sales: [d] }).eq("id", id).eq("status", "pending");

async function show(db: SupabaseClient, row: Row, d: Draft, mode: "edit" | "new") {
  const ctx = await salesContext(db, row.tenant_id);
  const { data: t } = await db.from("tenants").select("name").eq("id", row.tenant_id).maybeSingle();
  const opts = options(ctx.catalog, makePricer(ctx.catalog, ctx.campaigns), d.day);
  const v = render({ ...d, ref: row.id }, (t?.name as string) ?? "la tienda", ctx.catalog, opts);
  const chatId = Number(row.chat_id);
  const body = { chat_id: chatId, text: v.text, reply_markup: { inline_keyboard: v.keyboard } };
  if (mode === "edit" && d.wizard.msgId) {
    await telegram("editMessageText", { ...body, message_id: d.wizard.msgId });
    return;
  }
  // Mensaje nuevo (al empezar o después de escribir): el anterior se queda sin botones.
  if (d.wizard.msgId) await telegram("editMessageReplyMarkup", { chat_id: chatId, message_id: d.wizard.msgId, reply_markup: { inline_keyboard: [] } }).catch(() => {});
  const { json } = await telegram("sendMessage", body);
  const msgId = (json.result as { message_id?: number } | undefined)?.message_id;
  if (msgId) {
    d.wizard.msgId = msgId;
    await store(db, row.id, d);
  }
}

/** /vta: empieza una venta nueva en este chat (cancela la que haya quedado a medias). */
export async function startVta(db: SupabaseClient, tenant: Tenant, chatId: number) {
  const { data: open } = await db.from("sales_imports").select("id, sales").eq("chat_id", String(chatId)).eq("status", "pending");
  const stale = ((open ?? []) as { id: string; sales: Draft[] }[]).filter((r) => r.sales?.[0]?.wizard);
  for (const r of stale) {
    await db.from("sales_imports").update({ status: "cancelled" }).eq("id", r.id).eq("status", "pending");
    const m = r.sales[0].wizard.msgId;
    if (m) await telegram("editMessageText", { chat_id: chatId, message_id: m, text: "✖️ Esta venta quedó a medias y se canceló (empezaste otra con /vta)." }).catch(() => {});
  }
  const draft: Draft = { ref: "", day: limaToday(), channel: "", client: "", pay: "", lines: [], dIn: 0, dOut: 0, note: "", rows: [], wizard: { step: "canal", page: 0 } };
  const { data, error } = await db.from("sales_imports").insert({ tenant_id: tenant.id, chat_id: String(chatId), sales: [draft] }).select("id, tenant_id, chat_id, sales, status, created_at").single();
  if (error) throw new Error(error.message);
  await show(db, data as Row, draft, "new");
}

/** Botones de /vta (callback_data `v:<id>:<acción>[:<dato>]`). */
export async function onVtaButton(db: SupabaseClient, q: TgCallback) {
  const [, id, action, arg] = (q.data ?? "").split(":");
  const msg = q.message;
  const answer = (text = "") => telegram("answerCallbackQuery", { callback_query_id: q.id, text });
  if (!msg || !id) return void (await answer());
  const row = await load(db, id);
  if (!row || row.chat_id !== String(msg.chat.id)) return void (await answer("No encuentro esa venta"));
  if (row.status !== "pending") return void (await answer(row.status === "saved" ? "Ya estaba registrada" : "Ya estaba cancelada"));
  if (!(await tenantsOfChat(db, msg.chat.id)).some((t) => t.id === row.tenant_id)) return void (await answer("Este chat ya no está vinculado a la tienda"));
  const d = row.sales[0];
  const w = d.wizard;
  const edit = (text: string) => telegram("editMessageText", { chat_id: msg.chat.id, message_id: msg.message_id, text });
  if (Date.now() - Date.parse(row.created_at) > EXPIRES_MS) {
    await db.from("sales_imports").update({ status: "cancelled" }).eq("id", id);
    await edit("⌛ Esta venta venció. Empieza otra con /vta.");
    return void (await answer("Venció"));
  }
  if (w.msgId && w.msgId !== msg.message_id) return void (await answer("Usa el mensaje más reciente de esta venta"));
  const who = q.from.first_name ? ` por ${q.from.first_name}` : "";

  if (action === "x") {
    await db.from("sales_imports").update({ status: "cancelled" }).eq("id", id).eq("status", "pending");
    await edit(`✖️ Venta cancelada${who}. No se guardó nada.`);
    return void (await answer("Cancelada"));
  }

  const ctx = await salesContext(db, row.tenant_id);
  const pricer = makePricer(ctx.catalog, ctx.campaigns);
  const opts = options(ctx.catalog, pricer, d.day);

  if (action === "ok") {
    if (w.step !== "total" || !d.lines.length) return void (await answer());
    // Marca primero como guardada para que dos toques seguidos no registren dos veces.
    const { data: claimed } = await db.from("sales_imports").update({ status: "saved" }).eq("id", id).eq("status", "pending").select("id");
    if (!claimed?.length) return void (await answer("Ya estaba registrada"));
    const total = w.total ?? linesTotal(d.lines);
    const sale: SaleDraft = { ref: `m${fingerprint(`vta|${id}`)}`, day: d.day, channel: d.channel, client: "", pay: d.pay, lines: fitTotal(d.lines, total), dIn: 0, dOut: 0, note: "", rows: [] };
    const { error } = await db.from("manual_sales").upsert([saleRow(sale, { tenantId: row.tenant_id, catalog: ctx.catalog, source: "telegram", userId: null })], { onConflict: "tenant_id,ref", ignoreDuplicates: true });
    if (error) {
      await db.from("sales_imports").update({ status: "pending" }).eq("id", id);
      await answer("No se pudo guardar");
      throw new Error(error.message);
    }
    const items = d.lines.map((l) => `• ${lineName(ctx.catalog, l)} x${l.qty}`).join("\n");
    const fair = d.channel === "feria" ? await fairLine(db, row.tenant_id, d.day) : "";
    await edit(
      [`✅ Venta registrada${who}`, `${dayShort(d.day)} · ${label(WIZARD_CHANNELS, d.channel)} · ${label(WIZARD_PAYS, d.pay)}`, ...(fair ? [fair] : []), items, `Total: ${formatPrice(total)}`, "", "Ya está en Ventas y márgenes. Otra venta: /vta"].join("\n"),
    );
    return void (await answer("Listo"));
  }

  let say = "";
  if (action === "c" && w.step === "canal" && WIZARD_CHANNELS.some((c) => c[0] === arg)) {
    d.channel = arg;
    w.step = "pago";
  } else if (action === "p" && w.step === "pago" && WIZARD_PAYS[+arg]) {
    d.pay = WIZARD_PAYS[+arg][0];
    w.step = "items";
  } else if (action === "pg" && w.step === "items") {
    w.page = Math.max(0, +arg || 0);
  } else if (action === "i" && w.step === "items" && opts[+arg]) {
    w.pick = { productId: opts[+arg].productId, variantId: opts[+arg].variantId };
    w.step = "cantidad";
  } else if (action === "q" && w.step === "cantidad" && w.pick && +arg >= 1 && +arg <= 999) {
    const p = pricer(w.pick.productId, w.pick.variantId, d.day);
    d.lines = addLine(d.lines, { ...w.pick, qty: +arg, ...p });
    w.pick = undefined;
    w.total = undefined;
    w.step = "items";
    say = `Agregado x${arg}`;
  } else if (action === "qx" && w.step === "cantidad") {
    w.step = "cantidad_txt";
  } else if (action === "del" && w.step === "items" && d.lines.length) {
    d.lines = d.lines.slice(0, -1);
    w.total = undefined;
  } else if (action === "done" && w.step === "items" && d.lines.length) {
    w.step = "total";
  } else if (action === "t" && w.step === "total") {
    w.step = "total_txt";
  } else if (action === "tw" && w.step === "total") {
    w.total = undefined;
  } else if (action === "back") {
    const prev: Partial<Record<Step, Step>> = { pago: "canal", items: "pago", cantidad: "items", cantidad_txt: "cantidad", total: "items", total_txt: "total" };
    if (!prev[w.step]) return void (await answer());
    w.step = prev[w.step]!;
    if (w.step === "items") w.pick = undefined;
  } else return void (await answer());

  w.askId = undefined;
  await store(db, id, d);
  await show(db, row, d, "edit");
  if (w.step === "cantidad_txt" || w.step === "total_txt") {
    // En los grupos el bot solo lee lo que le responden: pide la respuesta con «responder».
    const { json } = await telegram("sendMessage", {
      chat_id: msg.chat.id,
      text: w.step === "total_txt" ? "¿Cuánto cobraste en total? (por ejemplo 65.50)" : "¿Cuántas unidades? (solo el número)",
      reply_markup: { force_reply: true, selective: true, input_field_placeholder: w.step === "total_txt" ? "Monto en soles" : "Cantidad" },
    });
    const askId = (json.result as { message_id?: number } | undefined)?.message_id;
    if (askId) {
      w.askId = askId;
      await store(db, id, d);
    }
  }
  await answer(say);
}

/**
 * Texto escrito durante /vta (cantidad u otro monto). Devuelve false si el mensaje no era para una venta en curso.
 * En privado vale cualquier texto; en grupos, solo la respuesta al mensaje del bot que lo pidió.
 */
export async function onVtaText(db: SupabaseClient, tenant: Tenant, m: TgMessage): Promise<boolean> {
  const text = (m.text ?? "").trim();
  if (!text || text.startsWith("/")) return false;
  const { data } = await db.from("sales_imports").select("id, tenant_id, chat_id, sales, status, created_at").eq("chat_id", String(m.chat.id)).eq("tenant_id", tenant.id).eq("status", "pending").order("created_at", { ascending: false }).limit(10);
  const waiting = ((data ?? []) as Row[]).filter((r) => {
    const w = r.sales?.[0]?.wizard;
    return w && (w.step === "cantidad_txt" || w.step === "total_txt") && Date.now() - Date.parse(r.created_at) <= EXPIRES_MS;
  });
  const reply = m.reply_to_message?.message_id;
  const row = waiting.find((r) => reply && r.sales[0].wizard.askId === reply) ?? (m.chat.type === "private" ? waiting[0] : undefined);
  if (!row) return false;
  const d = row.sales[0];
  const w = d.wizard;
  const retry = (t: string) =>
    telegram("sendMessage", { chat_id: m.chat.id, text: t, reply_to_message_id: m.message_id, reply_markup: { force_reply: true, selective: true } }).then(({ json }) => {
      const askId = (json.result as { message_id?: number } | undefined)?.message_id;
      if (askId) return store(db, row.id, { ...d, wizard: { ...w, askId } });
    });

  if (w.step === "cantidad_txt") {
    const qty = /^\d+$/.test(text) ? parseInt(text, 10) : NaN;
    if (!(qty >= 1 && qty <= 999) || !w.pick) {
      await retry("Escríbeme solo el número de unidades, entre 1 y 999.");
      return true;
    }
    const ctx = await salesContext(db, row.tenant_id);
    const p = makePricer(ctx.catalog, ctx.campaigns)(w.pick.productId, w.pick.variantId, d.day);
    d.lines = addLine(d.lines, { ...w.pick, qty, ...p });
    w.pick = undefined;
    w.total = undefined;
    w.step = "items";
  } else {
    const total = parseMoney(text);
    if (total === null || total <= 0 || total > MAX_TOTAL) {
      await retry("No entendí el monto. Escríbelo en soles, por ejemplo 65 o 65.50.");
      return true;
    }
    w.total = total;
    w.step = "total";
  }
  w.askId = undefined;
  await store(db, row.id, d);
  await show(db, row, d, "new");
  return true;
}

/** Feria en la que se cargó la venta (la base la asigna sola por fecha; misma regla que fair_on). */
async function fairLine(db: SupabaseClient, tenantId: string, day: string): Promise<string> {
  const { data, error } = await db.from("fairs").select("name, place").eq("tenant_id", tenantId).lte("starts_on", day).gte("ends_on", day)
    .order("starts_on", { ascending: false }).order("created_at", { ascending: false }).limit(1);
  if (error) return ""; // sin la migración 0012 no hay ferias
  const f = data?.[0] as { name: string; place: string | null } | undefined;
  return f ? `🎪 Feria: ${f.name}${f.place ? ` · ${f.place}` : ""}` : "🎪 Ninguna feria en esa fecha: créala en Ventas y márgenes y la venta se carga sola.";
}
