"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { useAdmin } from "../AdminContext";
import { useDb } from "../DbContext";
import { AdminPage, DemoNote } from "../AdminPage";
import { AIChevron } from "../AdminIcons";
import { initials } from "../AdminShell";
import { useRole } from "../useRole";
import { canSee, ROLES } from "@/lib/team/roles";
import { MIN_PASSWORD, passwordProblem, PasswordFields } from "./PasswordFields";

const SECTIONS = [
  { href: "/admin/pedidos", label: "Pedidos" },
  { href: "/admin/productos", label: "Productos" },
  { href: "/admin/inventario", label: "Inventario" },
  { href: "/admin/instagram", label: "Instagram" },
  { href: "/admin/ventas", label: "Ventas y márgenes" },
  { href: "/admin/reclamaciones", label: "Reclamaciones" },
  { href: "/admin/usuarios", label: "Usuarios" },
  { href: "/admin/ajustes", label: "Ajustes" },
];

/** Mi perfil: nombre, contraseña y sesiones de quien usa el panel. */
export function ProfileView() {
  const { toast, bundle } = useAdmin();
  const db = useDb();
  const router = useRouter();
  const role = useRole();
  const user = db?.state.phase === "ready" ? db.state.user : null;
  const email = user?.email ?? "tu-correo@ejemplo.com";
  const savedName = String(user?.user_metadata?.full_name ?? "").trim();
  const [name, setName] = useState(savedName);
  const [pass, setPass] = useState("");
  const [pass2, setPass2] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [passErr, setPassErr] = useState<string | null>(null);
  const info = ROLES.find((r) => r.id === role)!;

  const saveName = async (e: FormEvent) => {
    e.preventDefault();
    if (!db) return toast("Demo: el nombre se guarda con la base conectada.");
    setBusy("name");
    const { error } = await db.client.auth.updateUser({ data: { full_name: name.trim() } });
    setBusy(null);
    toast(error ? `No se pudo guardar: ${error.message}` : "Nombre guardado");
  };

  const savePass = async (e: FormEvent) => {
    e.preventDefault();
    const p = passwordProblem(pass, pass2);
    setPassErr(p);
    if (p) return;
    if (!db) return toast("Demo: la contraseña se cambia con la base conectada.");
    setBusy("pass");
    const { error } = await db.client.auth.updateUser({ password: pass });
    setBusy(null);
    if (error) {
      const msg = /reauth|recent/i.test(error.message)
        ? "Por seguridad, sal y vuelve a entrar antes de cambiar tu contraseña (o usa «¿Olvidaste tu contraseña?»)."
        : /different from the old/i.test(error.message)
          ? "La contraseña nueva tiene que ser distinta de la actual."
          : /weak|characters/i.test(error.message)
            ? `La contraseña es muy débil: usa al menos ${MIN_PASSWORD} caracteres, con letras y números.`
            : error.message;
      return setPassErr(msg);
    }
    setPass("");
    setPass2("");
    toast("Contraseña cambiada");
  };

  const signOutAll = async () => {
    if (!db) return router.push("/admin/login");
    setBusy("out");
    await db.client.auth.signOut({ scope: "global" });
    router.replace("/admin/login");
  };

  const links = SECTIONS.filter((s) => canSee(role, s.href));

  return (
    <AdminPage title="Mi perfil">
      <div className="a-head">
        <div className="row g4">
          <span className="a-me-av lg" aria-hidden="true">{initials(savedName || email)}</span>
          <div className="stack g1" style={{ minWidth: 0 }}>
            <h1 className="a-h1">{savedName || "Mi perfil"}</h1>
            <p className="a-sub">{email} · {info.label} en {bundle.tenant.name}</p>
          </div>
        </div>
      </div>

      <div className="a-cols even">
        <form className="a-card" onSubmit={saveName} aria-labelledby="pf-h">
          <h2 className="a-h3" id="pf-h">Tus datos</h2>
          <div className="a-field">
            <label htmlFor="pf-name">Nombre</label>
            <input id="pf-name" className="a-input" type="text" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Cómo te ve el equipo" />
          </div>
          <div className="a-field">
            <label htmlFor="pf-mail">Correo</label>
            <input id="pf-mail" className="a-input" type="email" value={email} readOnly aria-describedby="pf-mail-h" />
            <p className="a-cap" id="pf-mail-h">Con este correo entras al panel. Para usar otro, pide a un Dueño que invite tu correo nuevo.</p>
          </div>
          <div>
            <button className="a-btn primary" type="submit" disabled={busy !== null || name.trim() === savedName}>{busy === "name" ? "Guardando…" : "Guardar nombre"}</button>
          </div>
        </form>

        <form className="a-card" onSubmit={savePass} aria-labelledby="pp-h" noValidate>
          <h2 className="a-h3" id="pp-h">Cambiar contraseña</h2>
          <PasswordFields idPrefix="pp" pass={pass} pass2={pass2} setPass={setPass} setPass2={setPass2} />
          {passErr && <p className="a-err" role="alert">{passErr}</p>}
          <div>
            <button className="a-btn primary" type="submit" disabled={busy !== null || !pass}>{busy === "pass" ? "Cambiando…" : "Cambiar contraseña"}</button>
          </div>
        </form>
      </div>

      <section className="a-card" aria-labelledby="pr-h">
        <h2 className="a-h3" id="pr-h">Tu perfil: {info.label}</h2>
        <p className="a-sub">{info.summary}</p>
        <p className="a-cap">Solo un Dueño de la marca puede cambiar tu perfil, en <b>Usuarios</b>.</p>
      </section>

      <section className="a-card" aria-labelledby="ps-h">
        <h2 className="a-h3" id="ps-h">Sesiones</h2>
        <p className="a-sub">Si entraste desde una computadora que no es tuya, o perdiste tu celular, cierra la sesión en todos lados. Tendrás que volver a ingresar.</p>
        <div className="row g2 wrap-row">
          <button className="a-btn danger" type="button" onClick={() => void signOutAll()} disabled={busy !== null}>{busy === "out" ? "Cerrando…" : "Cerrar sesión en todos los dispositivos"}</button>
        </div>
      </section>

      <nav className="a-card flush only-m" aria-label="Más secciones">
        <div className="a-card-h"><h2 className="a-h3">Más secciones</h2></div>
        <div className="a-table">
          {links.map((l) => (
            <Link key={l.href} className="a-tr" href={l.href} style={{ gridTemplateColumns: "minmax(0,1fr) auto" }}>
              <b>{l.label}</b>
              <AIChevron size="sm" />
            </Link>
          ))}
        </div>
      </nav>

      <DemoNote untilDb>Demo: con la base conectada aquí cambias tu nombre y tu contraseña de verdad.</DemoNote>
    </AdminPage>
  );
}
