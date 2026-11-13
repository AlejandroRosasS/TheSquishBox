"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import {
  CHANNEL_NAMES, EMPTY_CONFIG, normalizeConfig, parseRecipient,
  type AlertConfig, type AlertEvent, type ChannelKey,
} from "@/lib/alerts/config";
import { orderMessage } from "@/lib/alerts/message";
import { ORDER_COLUMNS, orderCode, partyCode, whenShort, type OrderRow } from "@/lib/db/orders";
import { useAdmin } from "../AdminContext";
import { useDb } from "../DbContext";
import { AdminPage, Switch } from "../AdminPage";
import { AIAlert, AIMail, AITelegram, AIWhatsApp } from "../AdminIcons";

type Status = { server: boolean; ready: Record<ChannelKey, boolean>; bot: string | null; whatsappTemplate: boolean };
type OutRow = { id: number; channel: ChannelKey; label: string; status: string; last_error: string | null; created_at: string; event: string; orders: { number: number; kind: string; party?: unknown } | null };
type TgLink = { chatUrl: string; groupUrl: string; until: number };

const CH_STYLE: Record<ChannelKey, { icon: ReactNode; bg: string; fg: string }> = {
  telegram: { icon: <AITelegram />, bg: "#E6F1FB", fg: "#1D6FB8" },
  email: { icon: <AIMail />, bg: "#F1EAFA", fg: "#6B3FA0" },
  whatsapp: { icon: <AIWhatsApp />, bg: "#E4F2E7", fg: "#1F6B35" },
};

const OUT_STATUS: Record<string, [string, string]> = {
  sent: ["Enviado", "pagado"],
  pending: ["Reintentando", "pend"],
  sending: ["Enviando", "pend"],
  failed: ["Falló", "error"],
};

/** Admin › Notificaciones con la base: a quién avisar, por qué canal y el registro de los últimos avisos. */
export function NotificationsLive() {
  const db = useDb()!;
  const { bundle, toast } = useAdmin();
  const { tenant } = bundle;
  const tenantId = db.state.phase === "ready" ? db.state.tenantId : "";
  const [cfg, setCfg] = useState<AlertConfig | null>(null);
  const [status, setStatus] = useState<Status | null>(null);
  const [recent, setRecent] = useState<OutRow[]>([]);
  const [failCount, setFailCount] = useState(0);
  const [lastOrder, setLastOrder] = useState<OrderRow | null>(null);
  const [adding, setAdding] = useState<"email" | "whatsapp" | null>(null);
  const [newRcp, setNewRcp] = useState("");
  const [rcpError, setRcpError] = useState("");
  const [tg, setTg] = useState<TgLink | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const loadRecent = useCallback(async () => {
    const { data } = await db.client
      .from("alert_outbox")
      .select("id, channel, label, status, last_error, created_at, event, orders(number, kind, party)")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .limit(20);
    const rows = (data ?? []) as unknown as OutRow[];
    const since = Date.now() - 86_400_000;
    setRecent(rows);
    setFailCount(rows.filter((r) => r.status === "failed" && new Date(r.created_at).getTime() > since).length);
  }, [db.client, tenantId]);

  useEffect(() => {
    if (!tenantId) return;
    let alive = true;
    void (async () => {
      const [docRes, st, ord] = await Promise.all([
        db.client.from("site_docs").select("body").eq("tenant_id", tenantId).eq("kind", "notifications").eq("stage", "published").maybeSingle(),
        fetch("/api/alerts/status").then((r) => (r.ok ? (r.json() as Promise<Status>) : null)).catch(() => null),
        db.client.from("orders").select(ORDER_COLUMNS).eq("tenant_id", tenantId).eq("kind", "store").order("created_at", { ascending: false }).limit(1).maybeSingle(),
      ]);
      if (!alive) return;
      if (docRes.error) toast(`No se pudo leer la configuración: ${docRes.error.message}`);
      setCfg(normalizeConfig(docRes.data?.body ?? EMPTY_CONFIG));
      setStatus(st);
      setLastOrder((ord.data as OrderRow | null) ?? null);
      void loadRecent();
    })();
    return () => {
      alive = false;
    };
  }, [db.client, tenantId, toast, loadRecent]);

  const save = useCallback(
    async (next: AlertConfig) => {
      const before = cfg;
      setCfg(next);
      const { error } = await db.client
        .from("site_docs")
        .upsert({ tenant_id: tenantId, kind: "notifications", stage: "published", body: next, updated_at: new Date().toISOString() });
      if (error) {
        setCfg(before);
        toast(`No se guardó: ${error.message}`);
      }
    },
    [cfg, db.client, tenantId, toast],
  );

  // Vincular Telegram: mientras el link está abierto, revisa cada 4 s si ya tocaron «Iniciar».
  const checking = useRef(false);
  const checkTelegram = useCallback(
    async (manual: boolean) => {
      if (checking.current) return;
      checking.current = true;
      try {
        const r = await fetch("/api/alerts/telegram/check", { method: "POST" });
        const j = (await r.json().catch(() => ({}))) as { ok?: boolean; linked?: string[]; config?: unknown; message?: string };
        if (!j.ok) {
          if (manual) toast(j.message ?? "No se pudo revisar Telegram");
          return;
        }
        if (j.linked?.length) {
          setCfg(normalizeConfig(j.config));
          setTg(null);
          toast(`Conectado: ${j.linked.join(", ")}`);
        } else if (manual) toast("Todavía no llega. Toca «Iniciar» en Telegram y vuelve a intentar.");
      } finally {
        checking.current = false;
      }
    },
    [toast],
  );
  useEffect(() => {
    if (!tg) return;
    const t = setInterval(() => {
      if (Date.now() > tg.until) return setTg(null);
      if (document.visibilityState === "visible") void checkTelegram(false);
    }, 4000);
    return () => clearInterval(t);
  }, [tg, checkTelegram]);

  if (!cfg) {
    return (
      <AdminPage title="Notificaciones" back={{ href: "/admin/ajustes", label: "Ajustes" }}>
        <p className="a-sub">Cargando…</p>
      </AdminPage>
    );
  }

  const ch = cfg.channels;
  const activeChannels = (Object.keys(ch) as ChannelKey[]).filter((k) => ch[k].on && ch[k].recipients.length && (status?.ready[k] ?? true));

  const setChannel = (k: ChannelKey, patch: Partial<AlertConfig["channels"][ChannelKey]>) =>
    void save({ ...cfg, channels: { ...ch, [k]: { ...ch[k], ...patch } } });

  const addRcp = () => {
    if (!adding) return;
    const r = parseRecipient(adding, newRcp);
    if ("error" in r) return setRcpError(r.error);
    if (ch[adding].recipients.some((x) => x.to === r.to)) return setRcpError("Ya está en la lista");
    setChannel(adding, { recipients: [...ch[adding].recipients, r], on: true });
    setNewRcp("");
    setRcpError("");
    setAdding(null);
  };

  const startTelegram = async () => {
    setBusy("tg-link");
    try {
      const r = await fetch("/api/alerts/telegram/link", { method: "POST" });
      const j = (await r.json().catch(() => ({}))) as { ok?: boolean; chatUrl?: string; groupUrl?: string; message?: string };
      if (!j.ok || !j.chatUrl || !j.groupUrl) return toast(j.message ?? "No se pudo crear el link");
      setTg({ chatUrl: j.chatUrl, groupUrl: j.groupUrl, until: Date.now() + 10 * 60_000 });
    } finally {
      setBusy(null);
    }
  };

  const sendTest = async (k: ChannelKey) => {
    setBusy(`test-${k}`);
    try {
      const r = await fetch("/api/alerts/test", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ channel: k }) });
      const j = (await r.json().catch(() => ({}))) as { ok?: boolean; message?: string; results?: { label: string; ok: boolean; error?: string }[] };
      if (j.results) {
        const bad = j.results.filter((x) => !x.ok);
        toast(bad.length ? `No llegó a ${bad.map((x) => `${x.label} (${x.error})`).join(", ")}` : `Prueba enviada por ${CHANNEL_NAMES[k]}`);
      } else toast(j.message ?? "No se pudo enviar la prueba");
    } finally {
      setBusy(null);
    }
  };

  const pill = (k: ChannelKey): [string, string, string] => {
    if (status && !status.ready[k]) return ["Falta configurar", "cancelado", "La cuenta de este canal aún no está configurada en el servidor."];
    if (!ch[k].recipients.length) return ["Sin destinatarios", "cancelado", ""];
    const last = recent.find((r) => r.channel === k && r.status !== "pending" && r.status !== "sending");
    if (last?.status === "failed") return ["Error", "error", last.last_error ?? ""];
    return ["Conectado", "pagado", ""];
  };

  const card = (k: ChannelKey) => {
    const c = ch[k];
    const [st, stCls, stDetail] = pill(k);
    const { icon, bg, fg } = CH_STYLE[k];
    const ready = status?.ready[k] ?? false;
    return (
      <section className={`a-card ch ${c.on ? "" : "disabled"}`} aria-labelledby={`ch-${k}`} key={k}>
        <div className="ch-h">
          <span className="ch-ico" style={{ background: bg, color: fg }}>{icon}</span>
          <div className="grow">
            <b style={{ fontSize: 16 }} id={`ch-${k}`}>{CHANNEL_NAMES[k]}</b>
            <p className="a-cap">
              <span className={`st ${stCls}`} style={{ height: 20 }}>{st}</span>
              {k === "telegram" && status?.bot ? ` · Bot @${status.bot}` : ""}
              {stDetail ? ` · ${stDetail}` : ""}
            </p>
          </div>
          <Switch on={c.on} onChange={(v) => setChannel(k, { on: v })} label={`Activar ${CHANNEL_NAMES[k]}`} />
        </div>
        <div className="stack g2">
          <span className="a-label">Destinatarios</span>
          <div className="rcp">
            {c.recipients.map((r) => (
              <span key={r.to}>
                {r.label}
                <button type="button" className="a-btn sm ghost" style={{ minHeight: 28, padding: "0 4px" }} aria-label={`Quitar ${r.label}`} onClick={() => setChannel(k, { recipients: c.recipients.filter((x) => x.to !== r.to) })}>×</button>
              </span>
            ))}
            {k === "telegram" ? (
              <button className="a-btn sm ghost" type="button" disabled={!ready || busy === "tg-link"} onClick={() => void startTelegram()}>+ Vincular chat o grupo</button>
            ) : (
              <button className="a-btn sm ghost" type="button" onClick={() => { setAdding(k); setNewRcp(""); setRcpError(""); }}>+ Agregar</button>
            )}
          </div>
          {adding === k && (
            <form className="stack g1" onSubmit={(e) => { e.preventDefault(); addRcp(); }}>
              <label className="a-label" htmlFor={`new-${k}`}>{k === "email" ? "Correo" : "Celular con WhatsApp"}</label>
              <div className="row g2">
                <input
                  id={`new-${k}`}
                  className="a-input"
                  autoFocus
                  inputMode={k === "email" ? "email" : "tel"}
                  autoComplete="off"
                  value={newRcp}
                  aria-invalid={Boolean(rcpError)}
                  aria-describedby={rcpError ? `err-${k}` : undefined}
                  onChange={(e) => setNewRcp(e.target.value)}
                  placeholder={k === "email" ? "correo@…" : "9XX XXX XXX"}
                />
                <button className="a-btn sm primary" type="submit">Agregar</button>
                <button className="a-btn sm ghost" type="button" onClick={() => setAdding(null)}>Cancelar</button>
              </div>
              {rcpError && <p className="a-cap" id={`err-${k}`} style={{ color: "var(--a-red)" }}>{rcpError}</p>}
            </form>
          )}
          {k === "telegram" && tg && (
            <div className="a-banner info" role="status">
              <div className="stack g2">
                <span>Abre uno de estos links en el celular y toca <b>Iniciar</b>. Esta pantalla se actualiza sola.</span>
                <div className="row g2 wrap-row">
                  <a className="a-btn sm primary" href={tg.chatUrl} target="_blank" rel="noreferrer">Chat personal</a>
                  <a className="a-btn sm" href={tg.groupUrl} target="_blank" rel="noreferrer">Agregar a un grupo</a>
                  <button className="a-btn sm ghost" type="button" onClick={() => void checkTelegram(true)}>Ya lo hice</button>
                </div>
              </div>
            </div>
          )}
          {k === "whatsapp" && ready && !status?.whatsappTemplate && (
            <p className="a-cap">Sin plantilla aprobada, WhatsApp solo entrega el aviso si esa persona le escribió al número de alertas en las últimas 24 horas.</p>
          )}
        </div>
        <div className="row g2 wrap-row">
          <button className="a-btn sm" type="button" disabled={!ready || !c.recipients.length || busy === `test-${k}`} onClick={() => void sendTest(k)}>
            {busy === `test-${k}` ? "Enviando…" : "Enviar prueba"}
          </button>
        </div>
      </section>
    );
  };

  const evDefs: { key: AlertEvent | null; label: string; desc: string }[] = [
    { key: "order_new", label: "Nuevo pedido", desc: "Apenas el cliente confirma su compra (con tarjeta, cuando se aprueba el pago)" },
    { key: "review_new", label: "Nueva reseña", desc: "Cuando un cliente deja una reseña: la revisas y la publicas en Reseñas" },
    { key: null, label: "Pago de diferencia de delivery", desc: "Pronto" },
    { key: null, label: "Stock bajo", desc: "Pronto" },
  ];

  const preview = lastOrder ? orderMessage(lastOrder, "") : null;

  return (
    <AdminPage title="Notificaciones" back={{ href: "/admin/ajustes", label: "Ajustes" }}>
      <div className="a-head"><div className="stack g1"><h1 className="a-h1">Notificaciones</h1><p className="a-sub">Cómo y a quién del equipo avisamos cuando entra un pedido.</p></div></div>
      {!activeChannels.length && (
        <div className="a-banner err" role="alert"><AIAlert size="sm" /><span><b>Ningún canal está avisando.</b> Los pedidos igual quedan guardados en Pedidos, pero nadie del equipo recibirá el aviso. Activa al menos un canal con destinatarios.</span></div>
      )}
      {failCount > 0 && (
        <div className="a-banner warn" role="status"><AIAlert size="sm" /><span><b>{failCount === 1 ? "1 aviso no llegó" : `${failCount} avisos no llegaron`} en las últimas 24 horas.</b> Revisa el detalle abajo. Los pedidos están en Pedidos.</span></div>
      )}
      {status && !status.server && (
        <div className="a-banner warn" role="status"><AIAlert size="sm" /><span>Falta <code>SUPABASE_SECRET_KEY</code> en el servidor: los avisos quedan en cola, pero no se envían.</span></div>
      )}
      <div className="a-cols">
        <div className="stack g5">{(["telegram", "email", "whatsapp"] as ChannelKey[]).map(card)}</div>
        <div className="stack g5">
          <section className="a-card" aria-labelledby="n-ev">
            <h2 className="a-h2" id="n-ev">¿Qué nos avisa?</h2>
            {evDefs.map((e) => (
              <div className="ev" key={e.label}>
                <div><b>{e.label}</b><p className="a-cap">{e.desc}</p></div>
                <Switch
                  on={e.key ? cfg.events[e.key] : false}
                  disabled={!e.key}
                  onChange={(v) => e.key && void save({ ...cfg, events: { ...cfg.events, [e.key]: v } })}
                  label={e.label}
                />
              </div>
            ))}
          </section>
          <section className="a-card" aria-labelledby="n-prev">
            <div className="a-card-h"><h2 className="a-h2" id="n-prev">Vista previa</h2></div>
            <div className="chat">
              <span className="bot">{tenant.name} · ahora</span>
              <div className="bubble" style={{ whiteSpace: "pre-line" }}>
                {preview ? [preview.title, "", ...preview.lines].join("\n") : "Nuevo pedido #0001 · S/ 0.00\nAsí se verá el aviso con los datos del cliente, la entrega y los productos."}
                <span className="btnlink">Ver en el panel</span>
              </div>
            </div>
            {preview && <p className="a-cap">Con los datos de tu último pedido.</p>}
          </section>
          <section className="a-card" aria-labelledby="n-log">
            <div className="a-card-h">
              <h2 className="a-h2" id="n-log">Últimos avisos</h2>
              <button className="a-btn sm ghost" type="button" onClick={() => void loadRecent()}>Actualizar</button>
            </div>
            {recent.length === 0 ? (
              <p className="a-cap">Todavía no se ha enviado ningún aviso.</p>
            ) : (
              <ul className="stack g2" style={{ listStyle: "none", margin: 0, padding: 0 }}>
                {recent.map((r) => {
                  const [label, cls] = OUT_STATUS[r.status] ?? [r.status, "cancelado"];
                  const code = r.orders ? (r.orders.kind === "party" ? partyCode(r.orders.number, r.orders.party) : orderCode(r.orders.number)) : null;
                  return (
                    <li key={r.id} className="stack" style={{ gap: 2 }}>
                      <div className="row g2" style={{ justifyContent: "space-between" }}>
                        <span>
                          {r.event === "review_new" ? <Link href="/admin/resenas">Reseña</Link> : code ? <Link href={`/admin/pedidos/${code}`}>{r.orders?.kind === "party" ? code : `#${code}`}</Link> : "—"} · {CHANNEL_NAMES[r.channel]} · {r.label}
                        </span>
                        <span className={`st ${cls}`} style={{ height: 20 }}>{label}</span>
                      </div>
                      <span className="a-cap">{whenShort(r.created_at)}{r.last_error && r.status !== "sent" ? ` · ${r.last_error}` : ""}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
      </div>
    </AdminPage>
  );
}
