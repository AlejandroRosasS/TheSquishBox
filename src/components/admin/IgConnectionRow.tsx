"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useDb } from "./DbContext";
import { useAdmin } from "./AdminContext";
import { AIInstagram } from "./AdminIcons";

type Acct = { username: string; status: "ok" | "error" | "disconnected"; last_error: string | null; last_sync_at: string | null };

/**
 * Estado de Instagram en Admin › Ajustes › Conexiones.
 * Sale de la cuenta conectada de verdad (ig_accounts), no del usuario de Instagram que figura en la marca.
 */
export function IgConnectionRow() {
  const db = useDb();
  const { bundle } = useAdmin();
  const [acct, setAcct] = useState<Acct | null | undefined>(undefined);
  const client = db?.state.phase === "ready" ? db.client : null;
  const tenantId = db?.state.phase === "ready" ? db.state.tenantId : null;

  useEffect(() => {
    if (!client || !tenantId) return;
    let off = false;
    void client
      .from("ig_accounts")
      .select("username, status, last_error, last_sync_at")
      .eq("tenant_id", tenantId)
      .maybeSingle()
      .then(({ data, error }) => { if (!off) setAcct(error ? null : ((data as Acct | null) ?? null)); });
    return () => { off = true; };
  }, [client, tenantId]);

  const handle = bundle.tenant.instagram;
  let sub: string;
  let chip: [string, string];
  let action: React.ReactNode = null;
  if (!db) {
    sub = `@${handle} · posts de ejemplo`;
    chip = ["prep", "Demo"];
  } else if (acct === undefined) {
    sub = "Revisando la conexión…";
    chip = ["cancelado", "…"];
  } else if (!acct || acct.status === "disconnected") {
    sub = `Aún no conectas @${handle}. Necesitas una cuenta profesional (de empresa o de creador).`;
    chip = ["cancelado", "Sin conectar"];
    action = <a className="a-btn sm primary" href="/api/instagram/connect">Conectar Instagram</a>;
  } else if (acct.status === "error") {
    sub = `@${acct.username} · ${acct.last_error ?? "No se pudo sincronizar"}`;
    chip = ["error", "Con problemas"];
    action = <a className="a-btn sm" href="/api/instagram/connect">Volver a conectar</a>;
  } else {
    sub = `@${acct.username} · última sincronización ${ago(acct.last_sync_at)}`;
    chip = ["pagado", "Conectado"];
    action = <Link className="a-btn sm" href="/admin/instagram">Ver posts</Link>;
  }

  return (
    <div className="stack g2">
      <div className="row g3">
        <span className="ch-ico"><AIInstagram /></span>
        <div className="grow"><b>Instagram</b><p className="a-cap">{sub}</p></div>
        <span className={`st ${chip[0]}`}>{chip[1]}</span>
      </div>
      {action && <div className="row g2" style={{ paddingLeft: 56 }}>{action}</div>}
    </div>
  );
}

function ago(iso: string | null): string {
  if (!iso) return "pendiente";
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return "hace un momento";
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  return h < 24 ? `hace ${h} h` : `hace ${Math.round(h / 24)} d`;
}
