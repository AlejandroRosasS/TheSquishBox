"use client";

import { useState, type ReactNode } from "react";
import { dataKey, usePersisted } from "@/lib/admin/storage";
import type { Channel } from "@/lib/admin/types";
import { useAdmin } from "../AdminContext";
import { AdminPage, DemoNote, Switch } from "../AdminPage";
import { AIAlert, AIMail, AITelegram, AIWhatsApp } from "../AdminIcons";
import { useDb } from "../DbContext";
import { NotificationsLive } from "./NotificationsLive";

type State = { telegram: Channel; email: Channel; whatsapp: Channel; events: boolean[] };

/** Con Supabase: configuración real y envíos de verdad. Sin Supabase: la demo con datos de ejemplo. */
export function NotificationsView() {
  const db = useDb();
  if (db?.state.phase === "ready") return <NotificationsLive />;
  return <NotificationsDemo />;
}

function NotificationsDemo() {
  const { bundle, demo, toast } = useAdmin();
  const { tenant } = bundle;
  const [s, setS] = usePersisted<State>(dataKey(tenant.slug, "notifications"), { ...demo.notifications, events: [true, true, true, true] });
  const [prev, setPrev] = useState(0);
  const [adding, setAdding] = useState<keyof Omit<State, "events"> | null>(null);
  const [newRcp, setNewRcp] = useState("");
  const party = tenant.customOrder.enabled ? (tenant.customOrder.adminLabel ?? tenant.customOrder.label).toLowerCase() : null;
  const allOff = !s.telegram.on && !s.email.on && !s.whatsapp.on;

  const evDefs: [string, string][] = [
    ["Nuevo pedido pagado", "Apenas se confirma el pago"],
    ...(party ? [[`Nuevo pedido especial`, `Cuando llega una solicitud de ${party}`] as [string, string]] : []),
    ["Pago de diferencia de delivery", "Cuando el cliente paga el link"],
    ["Stock bajo", "Cuando una variante llega al mínimo"],
  ];
  const o = demo.orders[0];
  const previews = [
    `Nuevo pedido #${o.id}\n${o.client} · ${o.district} · ${o.date}`,
    ...(party ? [`Nuevo pedido especial ${demo.partyRequests[0]?.id}\n${demo.partyRequests[0]?.name} · ${demo.partyRequests[0]?.date}\n${demo.partyRequests[0]?.qty} · ${demo.partyRequests[0]?.size}`] : []),
    `Diferencia pagada · pedido #${demo.orders[2]?.id}\n${demo.orders[2]?.client} pagó la diferencia de delivery`,
    "Stock bajo\nRevisa Productos: hay variantes en el mínimo",
  ];

  const toggle = (k: keyof Omit<State, "events">) => setS((x) => ({ ...x, [k]: { ...x[k], on: !x[k].on } }));
  const removeRcp = (k: keyof Omit<State, "events">, r: string) => setS((x) => ({ ...x, [k]: { ...x[k], recipients: x[k].recipients.filter((y) => y !== r), bad: x[k].bad === r ? undefined : x[k].bad, status: x[k].bad === r ? "Conectado" : x[k].status } }));
  const addRcp = () => {
    if (!adding || !newRcp.trim()) return;
    setS((x) => ({ ...x, [adding]: { ...x[adding], recipients: [...x[adding].recipients, newRcp.trim()] } }));
    setNewRcp("");
    setAdding(null);
  };

  const card = (k: keyof Omit<State, "events">, title: string, icon: ReactNode, bg: string, fg: string, extra?: ReactNode) => {
    const c = s[k];
    const stCls = c.status === "Conectado" ? "pagado" : c.status === "Error" ? "error" : "cancelado";
    return (
      <section className={`a-card ch ${c.on ? "" : "disabled"}`} aria-labelledby={`ch-${k}`}>
        <div className="ch-h">
          <span className="ch-ico" style={{ background: bg, color: fg }}>{icon}</span>
          <div className="grow"><b style={{ fontSize: 16 }} id={`ch-${k}`}>{title}</b><p className="a-cap"><span className={`st ${stCls}`} style={{ height: 20 }}>{c.status}</span>{c.bot ? ` · Bot ${c.bot}` : ""}{c.detail ? ` · ${c.detail}` : ""}</p></div>
          <Switch on={c.on} onChange={() => toggle(k)} label={`Activar ${title}`} />
        </div>
        <div className="stack g2">
          <span className="a-label">Destinatarios</span>
          <div className="rcp">
            {c.recipients.map((r) => (
              <span key={r} style={r === c.bad ? { borderColor: "#F3C4BE", background: "#FDECEA" } : undefined}>
                {r}{r === c.bad ? " ⚠" : ""}
                <button type="button" className="a-btn sm ghost" style={{ minHeight: 28, padding: "0 4px" }} aria-label={`Quitar ${r}`} onClick={() => removeRcp(k, r)}>×</button>
              </span>
            ))}
            <button className="a-btn sm ghost" type="button" onClick={() => setAdding(k)}>+ Agregar</button>
          </div>
          {adding === k && (
            <form className="row g2" onSubmit={(e) => { e.preventDefault(); addRcp(); }}>
              <input className="a-input" autoFocus aria-label="Nuevo destinatario" value={newRcp} onChange={(e) => setNewRcp(e.target.value)} placeholder={k === "email" ? "correo@…" : k === "whatsapp" ? "+51 9…" : "Chat o grupo"} />
              <button className="a-btn sm primary" type="submit">Agregar</button>
            </form>
          )}
        </div>
        {c.bad && <div className="a-banner err" style={{ padding: "10px 12px", fontSize: 13 }}><span>{c.bad} no existe. Revísalo o quítalo.</span></div>}
        {extra}
        <div className="row g2 wrap-row"><button className="a-btn sm" type="button" disabled={!c.on || c.status !== "Conectado"} onClick={() => toast(`Prueba enviada por ${title}`)}>Enviar prueba</button></div>
      </section>
    );
  };

  return (
    <AdminPage title="Notificaciones" back={{ href: "/admin/ajustes", label: "Ajustes" }}>
      <div className="a-head"><div className="stack g1"><h1 className="a-h1">Notificaciones</h1><p className="a-sub">Cómo y a quién del equipo avisamos cuando pasa algo en la tienda.</p></div></div>
      {allOff && <div className="a-banner err" role="alert"><AIAlert size="sm" /><span><b>Todos los canales están apagados.</b> Nadie del equipo se enterará de los pedidos nuevos. Activa al menos uno.</span></div>}
      <div className="a-cols">
        <div className="stack g5">
          {card("telegram", "Telegram", <AITelegram />, "#E6F1FB", "#1D6FB8")}
          {card("email", "Correo", <AIMail />, "#F1EAFA", "#6B3FA0")}
          {card("whatsapp", "WhatsApp", <AIWhatsApp />, "#E4F2E7", "#1F6B35", s.whatsapp.status !== "Conectado" ? <button className="a-btn sm primary" type="button" style={{ alignSelf: "flex-start" }} onClick={() => toast("La conexión con WhatsApp Business llega en la Fase 3")}>Conectar WhatsApp Business</button> : null)}
        </div>
        <div className="stack g5">
          <section className="a-card" aria-labelledby="n-ev">
            <h2 className="a-h2" id="n-ev">¿Qué nos avisa?</h2>
            {evDefs.map(([label, desc], i) => (
              <div className="ev" key={label}><div><b>{label}</b><p className="a-cap">{desc}</p></div><Switch on={s.events[i] ?? true} onChange={(v) => setS((x) => ({ ...x, events: evDefs.map((_, j) => (j === i ? v : x.events[j] ?? true)) }))} label={label} /></div>
            ))}
          </section>
          <section className="a-card" aria-labelledby="n-prev">
            <div className="a-card-h"><h2 className="a-h2" id="n-prev">Vista previa</h2>
              <select className="a-select" style={{ width: "auto", minHeight: 44 }} value={prev} onChange={(e) => setPrev(Number(e.target.value))} aria-label="Evento de la vista previa">
                {evDefs.map(([l], i) => <option key={l} value={i}>{l}</option>)}
              </select>
            </div>
            <div className="chat"><span className="bot">{tenant.name} Alertas · ahora</span><div className="bubble">{previews[prev]}<span className="btnlink">Ver en el panel</span></div></div>
          </section>
          <DemoNote>Demo: no se envían mensajes reales. Las alertas por Telegram, correo y WhatsApp se conectan en la Fase 3.</DemoNote>
        </div>
      </div>
    </AdminPage>
  );
}
