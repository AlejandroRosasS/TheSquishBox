"use client";

import { useId, useRef, type ReactNode } from "react";

/**
 * Link «¿Qué es esto?» junto al título de un campo: abre una ventana con una explicación para quien
 * no conoce la herramienta y, si aplica, un enlace a la página de Google donde se saca el dato.
 */
export function HelpLink({ title, children, href, hrefLabel }: { title: string; children: ReactNode; href?: string; hrefLabel?: string }) {
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();
  return (
    <>
      <button type="button" className="a-help" aria-haspopup="dialog" onClick={() => ref.current?.showModal()}>
        ¿Qué es esto?<span className="sr-only"> {title}</span>
      </button>
      <dialog ref={ref} className="a-dialog" style={{ width: "min(520px, calc(100vw - 24px))" }} aria-labelledby={`${id}-h`}
        onClick={(e) => { if (e.target === e.currentTarget) ref.current?.close(); }}>
        <div className="stack g4">
          <h2 className="a-h2" id={`${id}-h`}>{title}</h2>
          <div className="stack g3 a-help-body">{children}</div>
          <div className="row g2" style={{ justifyContent: "flex-end", flexWrap: "wrap" }}>
            {href && <a className="a-btn" href={href} target="_blank" rel="noreferrer">{hrefLabel ?? "Abrir en Google"}<span className="sr-only"> (se abre en otra pestaña)</span></a>}
            <button className="a-btn primary" type="button" onClick={() => ref.current?.close()}>Entendido</button>
          </div>
        </div>
      </dialog>
    </>
  );
}
