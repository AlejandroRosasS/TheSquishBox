import { NextResponse, type NextRequest } from "next/server";
import { serviceClient, serviceConfigured } from "@/lib/db/service";
import { telegram } from "@/lib/alerts/channels";
import { migrateTelegramChat } from "@/lib/alerts/server";
import { formatPrice } from "@/lib/format";
import { MANUAL_CHANNELS, readSalesCsv, type SaleDraft } from "@/lib/sales/csv";
import { limaToday, makePricer } from "@/lib/sales/pricer";
import { promptCampaigns, salesPrompt } from "@/lib/sales/prompt";
import { saleRow } from "@/lib/sales/rows";
import { existingRefs, salesContext } from "@/lib/sales/server";
import { downloadFile, linkChat, tenantsOfChat, webhookSecret, type TgChat } from "@/lib/telegram/bot";
import { onVtaButton, onVtaText, startVta } from "@/lib/telegram/vta";
import { tenantSlug } from "@/lib/tenant";

/**
 * Webhook del bot de la marca de este despliegue (cada marca tiene su bot y su TELEGRAM_BOT_TOKEN). Recibe:
 * - /start <código>: vincula el chat a las alertas de una marca.
 * - Un CSV de ventas (archivo o texto pegado): responde con un resumen y botones Registrar/Cancelar.
 * - /prompt: el prompt para armar el CSV con Claude o ChatGPT.
 * - /vta: registrar una venta paso a paso con botones (src/lib/telegram/vta.ts).
 * Telegram firma cada llamada con `X-Telegram-Bot-Api-Secret-Token` (ver webhookSecret).
 */

type Message = {
  message_id: number;
  chat: TgChat;
  from?: { first_name?: string };
  text?: string;
  reply_to_message?: { message_id: number };
  caption?: string;
  document?: { file_id: string; file_name?: string; mime_type?: string; file_size?: number };
  migrate_to_chat_id?: number;
  migrate_from_chat_id?: number;
};
type Update = { update_id: number; message?: Message; callback_query?: { id: string; from: { first_name?: string }; data?: string; message?: Message } };

const MAX_FILE = 512 * 1024;
const MAX_LISTED = 12;
const EXPIRES_MS = 2 * 86_400_000;

const send = (chatId: number, text: string, extra: Record<string, unknown> = {}) => telegram("sendMessage", { chat_id: chatId, text, ...extra });

const HELP = (brand?: string) =>
  [
    `Hola${brand ? `, equipo de ${brand}` : ""}. Además de avisarte los pedidos, cargo ventas manuales (Instagram, ferias, colegios).`,
    "",
    "Una venta a la vez: escribe /vta y elige con los botones el canal, el pago, los productos y el monto.",
    "",
    "Varias ventas juntas (CSV):",
    "1. Escribe /prompt y copia lo que te mando.",
    "2. Pégalo en un chat nuevo de Claude o ChatGPT y cuéntale tus ventas.",
    "3. Mándame aquí el CSV que te devuelva: pegado como texto o como archivo.",
    "",
    "Te muestro un resumen y nada se guarda hasta que toques «Registrar».",
  ].join("\n");

export async function POST(req: NextRequest) {
  if (!process.env.TELEGRAM_BOT_TOKEN || req.headers.get("x-telegram-bot-api-secret-token") !== webhookSecret()) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  if (!serviceConfigured()) return NextResponse.json({ ok: false, message: "Falta SUPABASE_SECRET_KEY" }, { status: 503 });
  const update = (await req.json().catch(() => ({}))) as Update;
  try {
    if (update.callback_query) await onButton(update.callback_query);
    else if (update.message) await onMessage(update.message);
  } catch (e) {
    // Siempre 200: si no, Telegram reintenta el mismo mensaje una y otra vez.
    console.error("telegram webhook", e);
    const chatId = update.message?.chat.id ?? update.callback_query?.message?.chat.id;
    if (chatId) await send(chatId, "Algo falló de mi lado. Inténtalo de nuevo en un momento o carga las ventas en el panel (Ventas › Importar ventas).").catch(() => {});
  }
  return NextResponse.json({ ok: true });
}

const looksLikeCsv = (t: string) => {
  const first = t.split(/\r?\n/).find((l) => l.trim() && !/^\s*```/.test(l))?.toLowerCase() ?? "";
  return /\n/.test(t.trim()) && first.includes("fecha") && first.includes("producto");
};

async function onMessage(m: Message) {
  const db = serviceClient();
  // El grupo pasó a supergrupo y cambió de id: el destinatario de las alertas sigue al id nuevo.
  if (m.migrate_to_chat_id) return void (await migrateTelegramChat(db, String(m.chat.id), String(m.migrate_to_chat_id)));
  if (m.migrate_from_chat_id) return void (await migrateTelegramChat(db, String(m.migrate_from_chat_id), String(m.chat.id)));
  const text = (m.text ?? "").trim();
  const cmd = text.match(/^\/(\w+)(?:@\w+)?(?:\s+([\s\S]*))?$/);

  if (cmd?.[1] === "start" && cmd[2]?.trim()) {
    const linked = await linkChat(db, cmd[2].trim(), m.chat, { keepCode: true });
    if (!linked) await send(m.chat.id, "Ese link ya venció. Genera otro en el panel: Notificaciones › Telegram › Vincular chat o grupo.");
    return;
  }

  // Solo la marca de este bot: un mismo chat (por ejemplo, tu chat privado) puede estar con los bots de varias marcas.
  const tenants = (await tenantsOfChat(db, m.chat.id)).filter((t) => t.slug === tenantSlug());
  if (!tenants.length) {
    // Un chat sin vincular no ve datos de ninguna marca.
    if (cmd || m.document || looksLikeCsv(text)) await send(m.chat.id, "Este chat todavía no está vinculado a una tienda. Vincúlalo en el panel: Notificaciones › Telegram › Vincular chat o grupo.");
    return;
  }
  const tenant = tenants[0];

  if (cmd?.[1]?.toLowerCase() === "vta") {
    await startVta(db, tenant, m.chat.id);
    return;
  }
  // Cantidad u otro monto que pidió /vta.
  if (!cmd && !m.document && (await onVtaText(db, tenant, m))) return;

  if (cmd?.[1] === "prompt") {
    const ctx = await salesContext(db, tenant.id);
    const prompt = salesPrompt({ brand: tenant.name, catalog: ctx.catalog, campaigns: promptCampaigns(ctx.campaigns, Date.now()), today: limaToday() });
    await send(m.chat.id, "Copia el mensaje que sigue y pégalo en un chat nuevo de Claude o ChatGPT. Si cambian los precios o las campañas, pídemelo de nuevo con /prompt.");
    for (const part of chunks(prompt, 4000)) await send(m.chat.id, part);
    return;
  }
  if (cmd) {
    await send(m.chat.id, HELP(tenant.name));
    return;
  }

  let csv = "";
  if (m.document) {
    const d = m.document;
    const okType = /\.(csv|txt)$/i.test(d.file_name ?? "") || /^text\//.test(d.mime_type ?? "");
    if (!okType) return void (await send(m.chat.id, "Solo leo archivos .csv (o el CSV pegado como texto). Si es un Excel, guárdalo como «CSV UTF-8»."));
    if ((d.file_size ?? 0) > MAX_FILE) return void (await send(m.chat.id, "El archivo es muy grande. Mándame las ventas en partes."));
    csv = await downloadFile(d.file_id);
  } else if (looksLikeCsv(text)) csv = text;
  else {
    // En los grupos solo responde si le escriben a él; en privado, con la ayuda.
    if (m.chat.type === "private") await send(m.chat.id, HELP(tenant.name));
    return;
  }
  await review(db, tenant, m.chat.id, csv);
}

function chunks(s: string, max: number) {
  const out: string[] = [];
  let cur = "";
  for (const line of s.split("\n")) {
    if (cur && cur.length + line.length + 1 > max) {
      out.push(cur);
      cur = "";
    }
    cur = cur ? `${cur}\n${line}` : line;
  }
  if (cur) out.push(cur);
  return out;
}

const chanName = (k: string) => MANUAL_CHANNELS.find((c) => c[0] === k)?.[1] ?? k;
const saleTotal = (s: Pick<SaleDraft, "lines" | "dIn">) => s.lines.reduce((a, l) => a + l.price * l.qty, 0) + s.dIn;
const dayShort = (day: string) => `${+day.slice(8, 10)}/${+day.slice(5, 7)}`;

async function review(db: ReturnType<typeof serviceClient>, tenant: { id: string; name: string }, chatId: number, csv: string) {
  const ctx = await salesContext(db, tenant.id);
  const r = readSalesCsv(csv, { catalog: ctx.catalog, price: makePricer(ctx.catalog, ctx.campaigns), today: limaToday() });
  const known = await existingRefs(db, tenant.id, r.sales.map((s) => s.ref));
  const fresh = r.sales.filter((s) => !known.has(s.ref));
  const name = (pid: string, vid: string) => {
    const p = ctx.catalog.products.find((x) => x.id === pid);
    return p ? `${p.name}${p.variants.length > 1 ? ` (${p.variants.find((v) => v.id === vid)?.label ?? vid})` : ""}` : pid;
  };

  const lines: string[] = [`Revisé tu CSV de ${tenant.name}.`];
  if (fresh.length) {
    const sum = fresh.reduce((a, s) => a + saleTotal(s), 0);
    const camp = fresh.filter((s) => s.lines.some((l) => l.campaignId)).length;
    lines.push("", `✅ ${fresh.length} ${fresh.length === 1 ? "venta nueva" : "ventas nuevas"} · ${formatPrice(sum)}${camp ? ` · ${camp} con campaña` : ""}`);
    for (const s of fresh.slice(0, MAX_LISTED)) {
      const camps = [...new Set(s.lines.map((l) => l.campaign).filter(Boolean))];
      lines.push(`• ${dayShort(s.day)} · ${chanName(s.channel)} · ${s.lines.map((l) => `${name(l.productId, l.variantId)} x${l.qty}`).join(" + ")} · ${formatPrice(saleTotal(s))}${camps.length ? ` · campaña ${camps.join(", ")}` : ""}`);
    }
    if (fresh.length > MAX_LISTED) lines.push(`… y ${fresh.length - MAX_LISTED} más`);
  } else lines.push("", "No hay ventas nuevas para registrar.");
  if (known.size) lines.push("", `↩️ ${known.size} ya ${known.size === 1 ? "estaba cargada" : "estaban cargadas"}: no se repite.`);
  if (r.errors.length) {
    lines.push("", `⚠️ ${r.errors.length === 1 ? "Esta fila no se carga" : "Estas filas no se cargan"} (corrígelas y mándamelas de nuevo):`);
    for (const e of r.errors.slice(0, 8)) lines.push(`• ${e.row ? `Fila ${e.row}: ` : ""}${e.message}`);
    if (r.errors.length > 8) lines.push(`… y ${r.errors.length - 8} más`);
  }
  if (r.warnings.length) for (const w of r.warnings.slice(0, 4)) lines.push(`ℹ️ Fila ${w.row}: ${w.message}`);

  if (!fresh.length) return void (await send(chatId, lines.join("\n")));
  const { data, error } = await db.from("sales_imports").insert({ tenant_id: tenant.id, chat_id: String(chatId), sales: fresh }).select("id").single();
  if (error) throw new Error(error.message);
  const id = (data as { id: string }).id;
  await send(chatId, lines.join("\n"), {
    reply_markup: { inline_keyboard: [[{ text: `Registrar ${fresh.length} ${fresh.length === 1 ? "venta" : "ventas"}`, callback_data: `si:${id}` }, { text: "Cancelar", callback_data: `no:${id}` }]] },
  });
}

async function onButton(q: NonNullable<Update["callback_query"]>) {
  const db = serviceClient();
  if (q.data?.startsWith("v:")) return onVtaButton(db, q);
  const [action, id] = (q.data ?? "").split(":");
  const msg = q.message;
  const answer = (text: string) => telegram("answerCallbackQuery", { callback_query_id: q.id, text });
  if (!msg || !id || !["si", "no"].includes(action)) return void (await answer(""));
  const done = (extra: string) => telegram("editMessageText", { chat_id: msg.chat.id, message_id: msg.message_id, text: `${msg.text ?? ""}\n\n${extra}` });

  const { data: imp } = await db.from("sales_imports").select("id, tenant_id, chat_id, sales, status, created_at").eq("id", id).maybeSingle();
  if (!imp || imp.chat_id !== String(msg.chat.id)) return void (await answer("No encuentro esa importación"));
  // Las ventas de /vta tienen sus propios botones.
  if ((imp.sales as { wizard?: unknown }[]).some((s) => s.wizard)) return void (await answer(""));
  if (imp.status !== "pending") return void (await answer(imp.status === "saved" ? "Ya estaba registrada" : "Ya estaba cancelada"));
  // El chat tiene que seguir vinculado a la marca.
  if (!(await tenantsOfChat(db, msg.chat.id)).some((t) => t.id === imp.tenant_id)) return void (await answer("Este chat ya no está vinculado a la tienda"));
  if (Date.now() - Date.parse(imp.created_at as string) > EXPIRES_MS) {
    await db.from("sales_imports").update({ status: "cancelled" }).eq("id", id);
    await done("⌛ Venció. Mándame el CSV otra vez.");
    return void (await answer("Venció"));
  }
  const who = q.from.first_name ? ` por ${q.from.first_name}` : "";
  if (action === "no") {
    await db.from("sales_imports").update({ status: "cancelled" }).eq("id", id).eq("status", "pending");
    await done(`✖️ Cancelado${who}. No se guardó nada.`);
    return void (await answer("Cancelado"));
  }

  // Marca primero como guardada para que dos toques seguidos no registren dos veces.
  const { data: claimed } = await db.from("sales_imports").update({ status: "saved" }).eq("id", id).eq("status", "pending").select("id");
  if (!claimed?.length) return void (await answer("Ya estaba registrada"));
  const ctx = await salesContext(db, imp.tenant_id as string);
  const sales = imp.sales as SaleDraft[];
  const rows = sales.map((s) => saleRow(s, { tenantId: imp.tenant_id as string, catalog: ctx.catalog, source: "telegram", userId: null }));
  const { data: saved, error } = await db.from("manual_sales").upsert(rows, { onConflict: "tenant_id,ref", ignoreDuplicates: true }).select("id");
  if (error) {
    await db.from("sales_imports").update({ status: "pending" }).eq("id", id);
    await answer("No se pudo guardar");
    throw new Error(error.message);
  }
  const n = saved?.length ?? 0;
  const skipped = sales.length - n;
  await done(`✅ ${n} ${n === 1 ? "venta registrada" : "ventas registradas"}${who}.${skipped ? ` ${skipped} ya estaban.` : ""} Ya están en Ventas y márgenes.`);
  await answer("Listo");
}
