"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import type { EmailOtpType } from "@supabase/supabase-js";
import { Logo } from "@/components/Logo";
import { useBrandTenant } from "../useBrand";
import { useAdmin } from "../AdminContext";
import { DemoNote } from "../AdminPage";
import { useDb } from "../DbContext";
import { passwordProblem, PasswordFields } from "./PasswordFields";

type Step = "checking" | "form" | "expired" | "nosession";
const TYPES = ["invite", "magiclink", "recovery"] as const;

/**
 * /admin/clave: a donde llegan los enlaces de invitación y de contraseña nueva.
 * Valida el enlace (token_hash del correo del panel, o la sesión que deja el correo de Supabase)
 * y deja crear la contraseña. Luego entra al panel.
 */
export function SetPasswordView() {
  const { toast } = useAdmin();
  const brand = useBrandTenant();
  const db = useDb();
  const router = useRouter();
  const [step, setStep] = useState<Step>(db ? "checking" : "form");
  const [invite, setInvite] = useState(false);
  const [name, setName] = useState("");
  const [askName, setAskName] = useState(false);
  const [pass, setPass] = useState("");
  const [pass2, setPass2] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (!db || started.current) return;
    started.current = true;
    const client = db.client;
    const url = new URL(window.location.href);
    const hash = new URLSearchParams(url.hash.slice(1));
    const clean = () => history.replaceState(null, "", url.pathname);

    void (async () => {
      const tokenHash = url.searchParams.get("token_hash");
      const type = url.searchParams.get("type") as (typeof TYPES)[number] | null;
      let ok = false;
      if (tokenHash && type && TYPES.includes(type)) {
        setInvite(type === "invite");
        const { error } = await client.auth.verifyOtp({ token_hash: tokenHash, type: type as EmailOtpType });
        ok = !error;
      } else if (hash.get("access_token") && hash.get("refresh_token")) {
        // Correo de Supabase (sin Resend): la sesión llega en el #.
        setInvite(hash.get("type") === "invite");
        const { error } = await client.auth.setSession({ access_token: hash.get("access_token")!, refresh_token: hash.get("refresh_token")! });
        ok = !error;
      } else if (hash.get("error") || url.searchParams.get("error")) {
        ok = false;
      } else {
        // «¿Olvidaste tu contraseña?» sin Resend: el navegador cambia el ?code por la sesión solo.
        const { data } = await client.auth.getSession();
        ok = !!data.session;
        if (!ok && !url.searchParams.get("code")) {
          clean();
          return setStep("nosession");
        }
      }
      clean();
      if (!ok) return setStep("expired");
      const { data } = await client.auth.getUser();
      setAskName(!String(data.user?.user_metadata?.full_name ?? "").trim());
      setStep("form");
    })();
  }, [db]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const p = passwordProblem(pass, pass2);
    setError(p);
    if (p) return;
    if (!db) {
      toast("Demo: aquí se guardaría tu contraseña.");
      return router.push("/admin");
    }
    setBusy(true);
    const { error } = await db.client.auth.updateUser({ password: pass, ...(askName && name.trim() ? { data: { full_name: name.trim() } } : {}) });
    setBusy(false);
    if (error) {
      if (/different from the old/i.test(error.message)) return setError("La contraseña nueva tiene que ser distinta de la anterior.");
      return setError(error.message);
    }
    toast("Contraseña guardada");
    router.replace("/admin");
  };

  return (
    <main className="a-login" id="contenido">
      <div className="a-login-form">
        <div className="a-card">
          <div className="stack g3" style={{ alignItems: "center", textAlign: "center" }}>
            <Logo tenant={brand.tenant} resolve={brand.resolve} />
            <h1 className="a-h1">{step === "expired" ? "El enlace ya no sirve" : invite ? "Te damos la bienvenida" : "Crea tu contraseña"}</h1>
            {step === "form" && <p className="a-sub">{invite ? `Crea tu contraseña para entrar al panel de ${brand.tenant.name}.` : "Elige una contraseña nueva para entrar al panel."}</p>}
          </div>

          {step === "checking" && <p className="a-sub" role="status" style={{ textAlign: "center" }}>Revisando el enlace…</p>}

          {step === "expired" && (
            <div className="stack g3" role="alert">
              <p className="a-sub">Los enlaces sirven una sola vez y vencen pronto. Pide uno nuevo con «¿Olvidaste tu contraseña?» en la pantalla de ingreso, o pide a un Dueño de la marca que te reenvíe la invitación.</p>
              <Link className="a-btn primary block" href="/admin/login">Ir a ingresar</Link>
            </div>
          )}

          {step === "nosession" && (
            <div className="stack g3">
              <p className="a-sub">Abre esta página desde el enlace que te llegó al correo. Si ya tienes contraseña, ingresa normalmente.</p>
              <Link className="a-btn primary block" href="/admin/login">Ir a ingresar</Link>
            </div>
          )}

          {step === "form" && (
            <form className="stack g4" onSubmit={submit} noValidate>
              {askName && (
                <div className="a-field">
                  <label htmlFor="sp-name">Tu nombre</label>
                  <input id="sp-name" className="a-input" type="text" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Cómo te ve el equipo" />
                </div>
              )}
              <PasswordFields idPrefix="sp" pass={pass} pass2={pass2} setPass={setPass} setPass2={setPass2} />
              {error && <p className="a-err" role="alert">{error}</p>}
              <button className="a-btn primary block" type="submit" style={{ minHeight: 48 }} disabled={busy}>{busy ? "Guardando…" : "Guardar y entrar"}</button>
              {!db && <DemoNote>Demo: no se guarda nada. Con la base conectada, aquí llegan los enlaces de invitación y de contraseña nueva.</DemoNote>}
            </form>
          )}
        </div>
      </div>
    </main>
  );
}
