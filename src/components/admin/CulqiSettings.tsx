"use client";

import { useCallback, useEffect, useState } from "react";
import { useDb } from "./DbContext";
import { useAdmin } from "./AdminContext";
import { Switch } from "./AdminPage";
import { AICard } from "./AdminIcons";
import { refreshStore } from "@/app/admin/actions";

type Account = { public_key: string; live: boolean; enabled: boolean; updated_at: string };

/**
 * Cuenta de Culqi de la marca (Admin › Ajustes). Cada marca cobra con su propia cuenta.
 * La llave secreta se escribe aquí y se guarda en la base; nunca se vuelve a mostrar.
 */
export function CulqiSettings() {
  const db = useDb();
  const { bundle, toast } = useAdmin();
  const ready = db?.state.phase === "ready";
  const [acct, setAcct] = useState<Account | null | undefined>(undefined);
  const [pk, setPk] = useState("");
  const [sk, setSk] = useState("");
  const [on, setOn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [origin, setOrigin] = useState("");

  const load = useCallback(async () => {
    if (!db || db.state.phase !== "ready") return;
    const { data, error: e } = await db.client
      .from("payment_accounts")
      .select("public_key, live, enabled, updated_at")
      .eq("tenant_id", db.state.tenantId)
      .eq("provider", "culqi")
      .maybeSingle();
    if (e) {
      setError(/payment_accounts/.test(e.message) ? "Falta aplicar la migración de pagos en la base (0005_culqi.sql)." : e.message);
      setAcct(null);
      return;
    }
    const a = (data as Account | null) ?? null;
    setAcct(a);
    setPk(a?.public_key ?? "");
    setOn(a?.enabled ?? false);
  }, [db]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- el dominio solo se conoce en el navegador
    setOrigin(window.location.origin);
    void load();
  }, [load]);

  // Sin base (demo): solo el resumen.
  if (!db) {
    return (
      <div className="row g3"><span className="ch-ico"><AICard /></span><div className="grow"><b>Pasarela de pago</b><p className="a-cap">Culqi · se configura cuando la tienda está conectada a la base</p></div><span className="st prep">Demo</span></div>
    );
  }
  if (!ready || acct === undefined) return <p className="a-cap">Cargando pasarela de pago…</p>;

  const mode = !acct ? null : acct.live ? "Producción" : "Modo prueba";
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!/^pk_(test|live)_/.test(pk.trim())) return setError("La llave pública empieza con pk_test_ o pk_live_.");
    if (!acct && !sk.trim()) return setError("Escribe la llave secreta (sk_test_… o sk_live_…).");
    setBusy(true);
    const { error: e2 } = await db.client.rpc("save_culqi_account", {
      tenant_slug: bundle.tenant.slug,
      p_public_key: pk.trim(),
      p_secret_key: sk.trim(),
      p_enabled: on,
    });
    setBusy(false);
    if (e2) return setError(e2.message);
    setSk("");
    await refreshStore();
    await load();
    toast(on ? "Pago con tarjeta activo en la tienda" : "Llaves de Culqi guardadas");
  };

  return (
    <form className="stack g3" onSubmit={save} aria-labelledby="aj-culqi">
      <div className="row g3">
        <span className="ch-ico"><AICard /></span>
        <div className="grow"><b id="aj-culqi">Pago con tarjeta · Culqi</b><p className="a-cap">Cobras con tu propia cuenta de Culqi. Las llaves están en CulqiPanel › Desarrollo › API Keys.</p></div>
        <span className={`st ${!acct ? "cancelado" : acct.enabled ? (acct.live ? "pagado" : "prep") : "cancelado"}`}>{!acct ? "Sin conectar" : acct.enabled ? mode : "Apagado"}</span>
      </div>
      <div className="a-field"><label htmlFor="cq-pk">Llave pública</label><input id="cq-pk" className="a-input" autoComplete="off" spellCheck={false} placeholder="pk_test_…" value={pk} onChange={(e) => setPk(e.target.value)} /></div>
      <div className="a-field">
        <label htmlFor="cq-sk">Llave secreta</label>
        <input id="cq-sk" className="a-input" type="password" autoComplete="new-password" spellCheck={false} placeholder={acct ? "Guardada · escribe una nueva solo para cambiarla" : "sk_test_…"} value={sk} onChange={(e) => setSk(e.target.value)} />
        <span className="a-cap">Se guarda en el servidor y no se vuelve a mostrar. No la compartas por chat ni correo.</span>
      </div>
      <div className="row between"><div><b>Cobrar con tarjeta en la tienda</b><p className="a-cap">Apagado, la tienda no muestra la opción de tarjeta.</p></div><Switch on={on} onChange={setOn} label="Cobrar con tarjeta" /></div>
      {acct && !acct.live && <div className="a-banner warn" style={{ fontSize: 13, padding: "10px 12px" }}><span>Llaves de prueba: no se cobra dinero real. Cambia a las llaves de producción (pk_live / sk_live) antes de lanzar.</span></div>}
      <div className="a-field">
        <label htmlFor="cq-wh">URL del webhook (CulqiPanel › Eventos › Webhook)</label>
        <div className="row g2">
          <input id="cq-wh" className="a-input" readOnly value={`${origin}/api/culqi/webhook`} onFocus={(e) => e.currentTarget.select()} />
          <button className="a-btn sm" type="button" onClick={() => void navigator.clipboard?.writeText(`${origin}/api/culqi/webhook`).then(() => toast("URL copiada"))}>Copiar</button>
        </div>
        <span className="a-cap">Marca los eventos de cargos y devoluciones. Confirma el pago aunque el cliente cierre la página.</span>
      </div>
      {error && <div className="a-banner warn" role="alert" style={{ fontSize: 13, padding: "10px 12px" }}><span>{error}</span></div>}
      <button className="a-btn primary" type="submit" disabled={busy} style={{ alignSelf: "flex-start" }}>{busy ? "Guardando…" : "Guardar pasarela"}</button>
    </form>
  );
}
