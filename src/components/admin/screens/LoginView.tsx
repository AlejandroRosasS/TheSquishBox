"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Logo } from "@/components/Logo";
import { asset } from "@/lib/assets";
import { useAdmin } from "../AdminContext";
import { DemoNote } from "../AdminPage";

/* eslint-disable @next/next/no-img-element */

/** A-Login. En Fase 2 no valida la cuenta: entra directo con datos de ejemplo. */
export function LoginView() {
  const { bundle, toast } = useAdmin();
  const { tenant } = bundle;
  const router = useRouter();
  const [mail, setMail] = useState("");

  const submit = (e: FormEvent) => {
    e.preventDefault();
    router.push("/admin");
  };

  return (
    <main className="a-login" id="contenido">
      <div className="a-login-form">
        <form className="a-card" onSubmit={submit}>
          <div className="stack g3" style={{ alignItems: "center", textAlign: "center" }}>
            <Logo tenant={tenant} />
            <h1 className="a-h1">Panel de la tienda</h1>
            <p className="a-sub">Ingresa con tu correo del equipo.</p>
          </div>
          <div className="a-field">
            <label htmlFor="l-mail">Correo</label>
            <input id="l-mail" className="a-input" type="email" autoComplete="email" placeholder={`hola@${tenant.domain}`} value={mail} onChange={(e) => setMail(e.target.value)} />
          </div>
          <div className="a-field">
            <label htmlFor="l-pass">Contraseña</label>
            <input id="l-pass" className="a-input" type="password" autoComplete="current-password" />
          </div>
          <button className="a-btn primary block" type="submit" style={{ minHeight: 48 }}>Ingresar</button>
          <div className="row g3">
            <span style={{ flex: 1, height: 1, background: "var(--a-border)" }} />
            <span className="a-cap">o</span>
            <span style={{ flex: 1, height: 1, background: "var(--a-border)" }} />
          </div>
          <button className="a-btn block" type="button" onClick={() => toast("En la demo no se envían correos. Entra con «Ingresar».")}>
            Enviarme un enlace al correo
          </button>
          <DemoNote>Demo: el acceso con cuenta del equipo llega en la Fase 3. Por ahora «Ingresar» entra directo.</DemoNote>
        </form>
      </div>
      <div className="a-login-pic only-d">
        <img src={asset(tenant.slug, bundle.storefront.hero.image)} alt="" />
      </div>
    </main>
  );
}
