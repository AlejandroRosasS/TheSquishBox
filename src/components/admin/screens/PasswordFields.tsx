"use client";

import { useState } from "react";

export const MIN_PASSWORD = 8;

/** null = la contraseña sirve. */
export function passwordProblem(pass: string, pass2: string): string | null {
  if (pass.length < MIN_PASSWORD) return `Usa al menos ${MIN_PASSWORD} caracteres.`;
  if (!/[a-zA-ZñÑ]/.test(pass) || !/\d/.test(pass)) return "Mezcla letras y números.";
  if (pass !== pass2) return "Las dos contraseñas no coinciden.";
  return null;
}

/** Contraseña nueva + confirmación, con botón para mostrarla. */
export function PasswordFields({ idPrefix, pass, pass2, setPass, setPass2 }: { idPrefix: string; pass: string; pass2: string; setPass: (v: string) => void; setPass2: (v: string) => void }) {
  const [show, setShow] = useState(false);
  const type = show ? "text" : "password";
  return (
    <>
      <div className="a-field">
        <label htmlFor={`${idPrefix}-p1`}>Contraseña nueva</label>
        <div className="row g2">
          <input id={`${idPrefix}-p1`} className="a-input" type={type} autoComplete="new-password" value={pass} onChange={(e) => setPass(e.target.value)} aria-describedby={`${idPrefix}-ph`} />
          <button className="a-btn" type="button" onClick={() => setShow((v) => !v)} aria-pressed={show}>{show ? "Ocultar" : "Mostrar"}</button>
        </div>
        <p className="a-cap" id={`${idPrefix}-ph`}>Al menos {MIN_PASSWORD} caracteres, con letras y números.</p>
      </div>
      <div className="a-field">
        <label htmlFor={`${idPrefix}-p2`}>Repite la contraseña</label>
        <input id={`${idPrefix}-p2`} className="a-input" type={type} autoComplete="new-password" value={pass2} onChange={(e) => setPass2(e.target.value)} />
      </div>
    </>
  );
}
