"use client";

import { useId, useState } from "react";
import type { AdminCatalog } from "@/lib/admin/types";
import type { Line } from "@/lib/types";
import { AIDown, AITrash, AIUp } from "./AdminIcons";

type Mode = "view" | "edit" | "delete";

/** Renombra una línea (el id no cambia, así los links /tienda?linea=… siguen funcionando). */
export function renameLine(catalog: AdminCatalog, id: string, name: string): AdminCatalog {
  return { ...catalog, lines: catalog.lines.map((l) => (l.id === id ? { ...l, name } : l)) };
}

/** Borra una línea. Sus productos pasan a `moveTo` o, si es null, se borran con ella. */
export function deleteLine(catalog: AdminCatalog, id: string, moveTo: string | null): AdminCatalog {
  const lines = catalog.lines.filter((l) => l.id !== id).map((l, k) => ({ ...l, order: k + 1 }));
  const products =
    moveTo === null
      ? catalog.products.filter((p) => p.line !== id)
      : catalog.products.map((p) => (p.line === id ? { ...p, line: moveTo } : p));
  const lineNotes = { ...catalog.lineNotes };
  delete lineNotes[id];
  return { ...catalog, lines, products, lineNotes };
}

const sameName = (a: string, b: string) => a.trim().toLocaleLowerCase("es") === b.trim().toLocaleLowerCase("es");

/**
 * Cabecera de una línea en Productos: orden, nombre, subir/bajar y el panel
 * para renombrarla o borrarla (preguntando qué hacer con sus productos).
 */
export function LineHeader({
  line,
  index,
  catalog,
  caption,
  onMove,
  onChange,
  toast,
}: {
  line: Line;
  index: number;
  catalog: AdminCatalog;
  caption: string;
  onMove: (d: number) => void;
  onChange: (next: AdminCatalog) => void;
  toast: (msg: string) => void;
}) {
  const uid = useId();
  const [mode, setMode] = useState<Mode>("view");
  const [name, setName] = useState(line.name);
  const others = catalog.lines.filter((l) => l.id !== line.id);
  const count = catalog.products.filter((p) => p.line === line.id).length;
  const [fate, setFate] = useState<"move" | "delete">(others.length ? "move" : "delete");
  const [target, setTarget] = useState(others[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);

  const open = (m: Mode) => {
    setName(line.name);
    setFate(others.length ? "move" : "delete");
    setTarget(others[0]?.id ?? "");
    setError(null);
    setMode(m);
  };

  const save = () => {
    const n = name.trim();
    if (!n) return setError("Escribe un nombre para la línea.");
    if (others.some((l) => sameName(l.name, n))) return setError("Ya tienes otra línea con ese nombre.");
    if (n !== line.name) {
      onChange(renameLine(catalog, line.id, n));
      toast(`Línea renombrada a «${n}»`);
    }
    setMode("view");
  };

  const remove = () => {
    const moveTo = count && fate === "move" ? target : null;
    if (count && fate === "move" && !others.some((l) => l.id === moveTo)) return setError("Elige a qué línea pasan los productos.");
    onChange(deleteLine(catalog, line.id, count ? moveTo : null));
    const dest = others.find((l) => l.id === moveTo)?.name;
    toast(
      !count
        ? `Línea «${line.name}» borrada`
        : dest
          ? `Línea «${line.name}» borrada · ${count} ${count === 1 ? "producto pasó" : "productos pasaron"} a «${dest}»`
          : `Línea «${line.name}» y ${count === 1 ? "su producto borrados" : `sus ${count} productos borrados`}`,
    );
  };

  return (
    <>
      <div className="coll-h">
        <span className="ord">{index + 1}</span>
        <div className="stack grow" style={{ gap: 0, minWidth: 0 }}>
          <b style={{ fontSize: 15 }}>{line.name}</b>
          <span className="a-cap">{caption}</span>
        </div>
        <div className="mv">
          <button type="button" disabled={index === 0} onClick={() => onMove(-1)} aria-label={`Subir línea ${line.name}`}><AIUp size="sm" /></button>
          <button type="button" disabled={index === catalog.lines.length - 1} onClick={() => onMove(1)} aria-label={`Bajar línea ${line.name}`}><AIDown size="sm" /></button>
        </div>
        <button
          className="a-btn sm line-edit"
          type="button"
          aria-expanded={mode !== "view"}
          aria-controls={`${uid}-panel`}
          aria-label={`Editar línea ${line.name}`}
          onClick={() => (mode === "view" ? open("edit") : setMode("view"))}
        >
          {mode === "view" ? "Editar" : "Cerrar"}
        </button>
      </div>

      {mode === "edit" && (
        <form id={`${uid}-panel`} className="line-panel" onSubmit={(e) => { e.preventDefault(); save(); }}>
          <div className="a-field">
            <label htmlFor={`${uid}-name`}>Nombre de la línea</label>
            <input
              id={`${uid}-name`}
              className="a-input"
              autoFocus
              value={name}
              onChange={(e) => { setName(e.target.value); setError(null); }}
              aria-invalid={!!error}
              aria-describedby={error ? `${uid}-err` : `${uid}-hint`}
            />
            {error ? <p className="a-cap line-err" id={`${uid}-err`} role="alert">{error}</p> : <p className="a-cap" id={`${uid}-hint`}>Así se ve en el menú y los filtros de la tienda.</p>}
          </div>
          <div className="row g2 wrap-row">
            <button className="a-btn primary" type="submit">Guardar nombre</button>
            <button className="a-btn ghost" type="button" onClick={() => setMode("view")}>Cancelar</button>
            <button className="a-btn danger line-del" type="button" onClick={() => open("delete")}><AITrash size="sm" />Borrar línea</button>
          </div>
        </form>
      )}

      {mode === "delete" && (
        <div id={`${uid}-panel`} className="line-panel" role="group" aria-labelledby={`${uid}-dq`}>
          <p id={`${uid}-dq`} style={{ margin: 0 }}><b>¿Borrar la línea «{line.name}»?</b></p>
          {!count ? (
            <p className="a-cap">No tiene productos. Dejará de verse en la tienda.</p>
          ) : (
            <fieldset className="line-fate">
              <legend>Tiene {count} {count === 1 ? "producto" : "productos"}. ¿Qué hacemos con {count === 1 ? "él" : "ellos"}?</legend>
              {others.length > 0 && (
                <label className="line-opt">
                  <input type="radio" name={`${uid}-fate`} checked={fate === "move"} onChange={() => { setFate("move"); setError(null); }} />
                  <span className="stack" style={{ gap: 2 }}>
                    <b>Pasarlos a otra línea</b>
                    <span className="a-cap">Siguen en la tienda, con su stock y sus fotos.</span>
                  </span>
                </label>
              )}
              {others.length > 0 && fate === "move" && (
                <div className="a-field line-target">
                  <label htmlFor={`${uid}-to`}>Pasarlos a</label>
                  <select id={`${uid}-to`} className="a-select" value={target} onChange={(e) => setTarget(e.target.value)}>
                    {others.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                  </select>
                </div>
              )}
              <label className="line-opt">
                <input type="radio" name={`${uid}-fate`} checked={fate === "delete"} onChange={() => { setFate("delete"); setError(null); }} />
                <span className="stack" style={{ gap: 2 }}>
                  <b>Borrarlos también</b>
                  <span className="a-cap">Desaparecen de la tienda y del admin. No se puede deshacer.</span>
                </span>
              </label>
            </fieldset>
          )}
          {error && <p className="a-cap line-err" role="alert">{error}</p>}
          <div className="row g2 wrap-row">
            <button className="a-btn danger" type="button" onClick={remove}>
              <AITrash size="sm" />
              {count && fate === "delete" ? `Borrar línea y ${count === 1 ? "producto" : `${count} productos`}` : "Borrar línea"}
            </button>
            <button className="a-btn ghost" type="button" onClick={() => setMode("view")}>Cancelar</button>
          </div>
        </div>
      )}
    </>
  );
}
