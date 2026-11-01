"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "@/components/Logo";
import { useAdmin } from "./AdminContext";
import { useDb } from "./DbContext";
import { AIBack } from "./AdminIcons";

type Props = {
  /** Título corto de la barra superior en celular. */
  title: string;
  back?: { href: string; label: string };
  topRight?: ReactNode;
  children: ReactNode;
};

/** Barra superior (celular) + contenido de una pantalla del panel. */
export function AdminPage({ title, back, topRight, children }: Props) {
  const { bundle } = useAdmin();
  return (
    <>
      <div className="a-top">
        {back ? (
          <Link className="row g2" href={back.href} style={{ textDecoration: "none", minHeight: 44 }} aria-label={`Volver a ${back.label}`}>
            <AIBack />
            <b>{title}</b>
          </Link>
        ) : (
          <div className="row g3">
            <Logo tenant={bundle.tenant} size="sm" />
            <b>{title}</b>
          </div>
        )}
        {topRight ?? <span />}
      </div>
      <main className="a-main" id="contenido">
        {children}
      </main>
    </>
  );
}

export function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link className="a-cap only-d" href={href} style={{ textDecoration: "none" }}>
      ← {label}
    </Link>
  );
}

/** Interruptor accesible (role=switch). */
export function Switch({ on, onChange, label, disabled }: { on: boolean; onChange?: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button
      className={`a-switch ${on ? "on" : ""}`}
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange?.(!on)}
    />
  );
}

/** Aviso de la demo. `untilDb`: deja de mostrarse cuando la tienda está conectada a la base de datos. */
export function DemoNote({ children, untilDb }: { children: ReactNode; untilDb?: boolean }) {
  const db = useDb();
  if (untilDb && db) return null;
  return <p className="a-demo">{children}</p>;
}
