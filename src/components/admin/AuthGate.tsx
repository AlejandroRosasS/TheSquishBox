"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { useDb } from "./DbContext";

/** Con Supabase, el panel solo se muestra a alguien del equipo de la marca. En modo demo no hace nada. */
export function AuthGate({ children }: { children: ReactNode }) {
  const db = useDb();
  const router = useRouter();
  const phase = db?.state.phase;

  useEffect(() => {
    if (phase === "signed-out") router.replace("/admin/login");
  }, [phase, router]);

  if (!db || db.state.phase === "ready") return <>{children}</>;

  const s = db.state;
  return (
    <main className="a-login" id="contenido">
      <div className="a-login-form">
        <div className="a-card stack g3" role="status" aria-live="polite">
          {s.phase === "loading" && <p className="a-sub">Cargando tu panel…</p>}
          {s.phase === "signed-out" && <p className="a-sub">Ingresa con tu cuenta para continuar…</p>}
          {s.phase === "no-access" && (
            <>
              <h1 className="a-h1">Sin acceso a esta tienda</h1>
              <p className="a-sub">La cuenta {s.user.email} no es parte del equipo de esta marca. Pide que te agreguen o ingresa con otra cuenta.</p>
              <SignOutButton />
            </>
          )}
          {s.phase === "error" && (
            <>
              <h1 className="a-h1">No pudimos cargar el panel</h1>
              <p className="a-sub">{s.message}</p>
              <button className="a-btn" type="button" onClick={() => window.location.reload()}>Reintentar</button>
            </>
          )}
        </div>
      </div>
    </main>
  );
}

export function SignOutButton() {
  const db = useDb();
  const router = useRouter();
  if (!db) return <Link className="a-btn sm ghost" href="/admin/login">Salir</Link>;
  return (
    <button
      className="a-btn sm ghost"
      type="button"
      onClick={async () => {
        await db.signOut();
        router.replace("/admin/login");
      }}
    >
      Salir
    </button>
  );
}
