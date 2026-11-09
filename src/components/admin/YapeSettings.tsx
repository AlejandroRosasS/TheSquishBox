"use client";

/* eslint-disable @next/next/no-img-element */
import { useCallback, useEffect, useRef, useState } from "react";
import { useDb } from "./DbContext";
import { useAdmin } from "./AdminContext";
import { Switch } from "./AdminPage";
import { AIQr } from "./AdminIcons";
import { refreshStore } from "@/app/admin/actions";
import { asset } from "@/lib/assets";
import { isPlaceholder } from "@/lib/legal";
import type { Tenant } from "@/lib/types";

type Yape = NonNullable<Tenant["payments"]["yape"]>;
type TenantDoc = Tenant & Record<string, unknown>;

const MAX_QR_MB = 5;

/** «984775300», «+51 984 775 300» o «51984775300» → «+51 984 775 300». null si no es un celular peruano. */
function normPhone(v: string): string | null {
  const d = v.replace(/\D/g, "").replace(/^51(?=9\d{8}$)/, "");
  return /^9\d{8}$/.test(d) ? `+51 ${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6)}` : null;
}

/**
 * Yape manual de la marca (Admin › Ajustes › Conexiones): número, titular y QR que ve el cliente al pagar.
 * Vive en el documento publicado de la marca (site_docs kind 'tenant', `payments.yape`), el mismo que lee la tienda.
 * Es distinto del WhatsApp de contacto.
 */
export function YapeSettings() {
  const db = useDb();
  const { bundle, toast } = useAdmin();
  const slug = bundle.tenant.slug;
  const ready = db?.state.phase === "ready";
  const [doc, setDoc] = useState<TenantDoc | null | undefined>(undefined);
  const [phone, setPhone] = useState("");
  const [holder, setHolder] = useState("");
  const [qr, setQr] = useState("");
  const [on, setOn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    if (!db || db.state.phase !== "ready") return;
    const { data, error: e } = await db.client.from("site_docs").select("body").eq("tenant_id", db.state.tenantId).eq("kind", "tenant").eq("stage", "published").maybeSingle();
    if (e) { setError(e.message); setDoc(null); return; }
    const body = (data?.body as TenantDoc | undefined) ?? null;
    setDoc(body);
    if (!body) return;
    const y = body.payments.yape;
    setPhone(y?.phone && !isPlaceholder(y.phone) ? y.phone : "");
    setHolder(y?.holder ?? "");
    setQr(y?.qr ?? "");
    setOn(body.payments.methods.includes("yape"));
  }, [db]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial desde la base
    void load();
  }, [load]);

  const y = bundle.tenant.payments.yape;
  // Sin base (demo): solo el resumen, como Culqi.
  if (!db) {
    const has = !!y?.phone && !isPlaceholder(y.phone);
    return (
      <div className="row g3"><span className="ch-ico"><AIQr /></span><div className="grow"><b>Yape</b><p className="a-cap">{has ? y!.phone : "Número y QR"} · se configura cuando la tienda está conectada a la base</p></div><span className="st prep">Demo</span></div>
    );
  }
  if (!ready || doc === undefined) return <p className="a-cap">Cargando Yape…</p>;

  const saved = doc?.payments.yape;
  const savedOk = !!saved?.phone && !isPlaceholder(saved.phone);
  const savedOn = !!doc?.payments.methods.includes("yape");

  const pickQr = async (file: File | undefined) => {
    if (!file || db.state.phase !== "ready") return;
    setError(null);
    if (!/^image\/(png|jpeg|webp)$/.test(file.type)) return setError("Sube el QR como imagen PNG, JPG o WebP.");
    if (file.size > MAX_QR_MB * 1024 * 1024) return setError(`El QR pesa más de ${MAX_QR_MB} MB.`);
    setUploading(true);
    // Se sube tal cual (sin recomprimir) para que el QR siga siendo nítido y se pueda escanear.
    const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
    const path = `${slug}/yape-qr-${Date.now().toString(36)}.${ext}`;
    const { error: e } = await db.client.storage.from("media").upload(path, file, { contentType: file.type, cacheControl: "31536000" });
    setUploading(false);
    if (e) return setError(`No se pudo subir el QR (${e.message}).`);
    setQr(db.client.storage.from("media").getPublicUrl(path).data.publicUrl);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!doc) return setError("La marca no está cargada en la base.");
    const p = phone.trim() ? normPhone(phone) : null;
    if (phone.trim() && !p) return setError("Escribe un celular de 9 dígitos que empiece con 9 (ej.: 984 775 300).");
    if (on && !p) return setError("Para cobrar con Yape escribe el número de Yape.");
    setBusy(true);
    const yape: Yape = { phone: p ?? "", ...(holder.trim() ? { holder: holder.trim() } : {}), qr };
    const methods = doc.payments.methods.filter((m) => m !== "yape");
    // Yape va primero: es el medio por defecto en el checkout.
    const body: TenantDoc = { ...doc, payments: { ...doc.payments, methods: on ? ["yape", ...methods] : methods, yape } };
    const { data: saved2, error: e2 } = await db.client.from("site_docs").update({ body, updated_at: new Date().toISOString() }).eq("tenant_id", (db.state as { tenantId: string }).tenantId).eq("kind", "tenant").eq("stage", "published").select("tenant_id");
    setBusy(false);
    if (e2) return setError(e2.message);
    // Sin filas = la base no dejó cambiarlo (solo los gestores de la marca editan estos datos).
    if (!saved2?.length) return setError("No tienes permiso para cambiar los datos de pago. Pídeselo a quien administra la tienda.");
    if (p) setPhone(p);
    await refreshStore();
    await load();
    toast(on ? "Yape activo en la tienda" : "Datos de Yape guardados");
  };

  return (
    <form className="stack g3" onSubmit={save} aria-labelledby="aj-yape">
      <div className="row g3">
        <span className="ch-ico"><AIQr /></span>
        <div className="grow"><b id="aj-yape">Yape</b><p className="a-cap">El cliente yapea a este número (o escanea el QR) y te manda la captura por WhatsApp. Es distinto del WhatsApp de contacto.</p></div>
        <span className={`st ${savedOn && savedOk ? "pagado" : savedOk ? "cancelado" : "pend"}`}>{savedOn && savedOk ? "Activo" : savedOk ? "Apagado" : "Falta"}</span>
      </div>
      <div className="a-grid2">
        <div className="a-field">
          <label htmlFor="yp-phone">Número de Yape</label>
          <input id="yp-phone" className="a-input" type="tel" inputMode="tel" autoComplete="off" placeholder="9XX XXX XXX" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
        <div className="a-field">
          <label htmlFor="yp-holder">A nombre de (opcional)</label>
          <input id="yp-holder" className="a-input" autoComplete="off" placeholder="Como aparece en Yape" value={holder} onChange={(e) => setHolder(e.target.value)} />
        </div>
      </div>
      <div className="a-field">
        <span className="a-field-legend" id="yp-qr-l" style={{ margin: 0 }}>QR de Yape (opcional)</span>
        <div className="row g3" style={{ alignItems: "center", flexWrap: "wrap" }}>
          {qr ? (
            <img src={asset(slug, qr)} alt="QR de Yape" width={112} height={112} style={{ borderRadius: 12, border: "1px solid var(--a-border)", background: "#fff", objectFit: "contain" }} />
          ) : (
            <span className="a-cap" style={{ width: 112, height: 112, borderRadius: 12, border: "1px dashed var(--a-border)", display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center" }}>Sin QR</span>
          )}
          <div className="stack g2">
            <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(e) => { void pickQr(e.target.files?.[0]); e.target.value = ""; }} />
            <button className="a-btn sm" type="button" aria-describedby="yp-qr-l" disabled={uploading} onClick={() => fileRef.current?.click()}>{uploading ? "Subiendo…" : qr ? "Cambiar QR" : "Subir QR"}</button>
            {qr && <button className="a-btn sm ghost" type="button" onClick={() => setQr("")}>Quitar QR</button>}
          </div>
        </div>
        <span className="a-cap">En Yape: «Mi QR» › Descargar. Se muestra en el checkout junto al número.</span>
      </div>
      <div className="row between"><div><b>Cobrar con Yape en la tienda</b><p className="a-cap">Apagado, la tienda no muestra la opción de Yape.</p></div><Switch on={on} onChange={setOn} label="Cobrar con Yape" /></div>
      {error && <div className="a-banner warn" role="alert" style={{ fontSize: 13, padding: "10px 12px" }}><span>{error}</span></div>}
      <button className="a-btn primary" type="submit" disabled={busy || uploading} style={{ alignSelf: "flex-start" }}>{busy ? "Guardando…" : "Guardar Yape"}</button>
    </form>
  );
}
