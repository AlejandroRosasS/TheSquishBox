"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Logo } from "@/components/Logo";
import { asset } from "@/lib/assets";
import { useBrandTenant } from "../useBrand";
import { useAdmin } from "../AdminContext";
import { DemoNote } from "../AdminPage";
import { useDb } from "../DbContext";
import { requestPasswordReset } from "@/app/admin/team-actions";

/* eslint-disable @next/next/no-img-element */

/** A-Login. Con Supabase: correo y contraseña, o enlace al correo. En modo demo entra directo. */
export function LoginView() {
  const { bundle, toast } = useAdmin();
  const { tenant } = bundle;
  const brand = useBrandTenant();
  const router = useRouter();
  const db = useDb();
  const [mail, setMail] = useState("");
  const [pass, setPass] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!db) return router.push("/admin");
    setBusy(true);
    setError(null);
    const { error } = await db.client.auth.signInWithPassword({ email: mail.trim(), password: pass });
    setBusy(false);
    if (error) return setError(error.message === "Invalid login credentials" ? "Correo o contraseña incorrectos." : error.message);
    router.push("/admin");
  };

  const sendLink = async () => {
    if (!db) return toast("En la demo no se envían correos. Entra con «Ingresar».");
    if (!mail.trim()) return setError("Escribe tu correo para enviarte el enlace.");
    setBusy(true);
    setError(null);
    const { error } = await db.client.auth.signInWithOtp({
      email: mail.trim(),
      options: { shouldCreateUser: false, emailRedirectTo: `${window.location.origin}/admin` },
    });
    setBusy(false);
    if (error) return setError(error.message);
    toast(`Te enviamos un enlace a ${mail.trim()}`);
  };

  const forgot = async () => {
    if (!db) return toast("En la demo no se envían correos. Entra con «Ingresar».");
    const email = mail.trim();
    if (!email) return setError("Escribe tu correo arriba y vuelve a tocar «¿Olvidaste tu contraseña?».");
    setBusy(true);
    setError(null);
    const r = await requestPasswordReset(email);
    if (r.ok && r.fallback) {
      // El servidor no tiene correo propio: lo pide el navegador a Supabase (el enlace vuelve a este navegador).
      await db.client.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/admin/clave` });
    }
    setBusy(false);
    if (!r.ok) return setError(r.message);
    toast(`Si ${email} es del equipo, te llegará un enlace para crear una contraseña nueva.`);
  };

  return (
    <main className="a-login" id="contenido">
      <div className="a-login-form">
        <form className="a-card" onSubmit={submit}>
          <div className="stack g3" style={{ alignItems: "center", textAlign: "center" }}>
            <Logo tenant={brand.tenant} resolve={brand.resolve} />
            <h1 className="a-h1">Panel de la tienda</h1>
            <p className="a-sub">Ingresa con tu correo del equipo.</p>
          </div>
          <div className="a-field">
            <label htmlFor="l-mail">Correo</label>
            <input id="l-mail" className="a-input" type="email" autoComplete="email" placeholder={`hola@${tenant.domain}`} value={mail} onChange={(e) => setMail(e.target.value)} />
          </div>
          <div className="a-field">
            <label htmlFor="l-pass">Contraseña</label>
            <input id="l-pass" className="a-input" type="password" autoComplete="current-password" value={pass} onChange={(e) => setPass(e.target.value)} required={!!db} />
          </div>
          <div className="row" style={{ justifyContent: "flex-end", marginTop: -6 }}>
            <button className="a-btn sm ghost" type="button" onClick={() => void forgot()} disabled={busy}>¿Olvidaste tu contraseña?</button>
          </div>
          {error && <p className="a-err" role="alert">{error}</p>}
          <button className="a-btn primary block" type="submit" style={{ minHeight: 48 }} disabled={busy}>{busy ? "Ingresando…" : "Ingresar"}</button>
          <div className="row g3">
            <span style={{ flex: 1, height: 1, background: "var(--a-border)" }} />
            <span className="a-cap">o</span>
            <span style={{ flex: 1, height: 1, background: "var(--a-border)" }} />
          </div>
          <button className="a-btn block" type="button" onClick={sendLink} disabled={busy}>
            Enviarme un enlace al correo
          </button>
          {!db && <DemoNote>Demo: el acceso con cuenta del equipo llega en la Fase 3. Por ahora «Ingresar» entra directo.</DemoNote>}
        </form>
      </div>
      <div className="a-login-pic only-d">
        <img src={asset(tenant.slug, bundle.storefront.hero.image)} alt="" />
      </div>
    </main>
  );
}
