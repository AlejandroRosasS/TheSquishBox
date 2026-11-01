"use client";

import { useState } from "react";
import { normalizeHex } from "@/lib/color";

type Props = { id: string; label: string; hint?: string; value: string; onChange: (hex: string) => void; bad?: boolean };

/** Selector de color + código hexadecimal, con label visible. */
export function ColorField({ id, label, hint, value, onChange, bad }: Props) {
  const [text, setText] = useState<string | null>(null);
  const shown = text ?? value;
  const invalid = text !== null && !normalizeHex(text);
  return (
    <div className="a-field">
      <label htmlFor={`${id}-hex`}>
        {label} {hint && <span className="a-cap">({hint})</span>}
      </label>
      <div className={`color-in ${bad || invalid ? "bad" : ""}`}>
        <input type="color" value={value} onChange={(e) => { setText(null); onChange(e.target.value.toUpperCase()); }} aria-label={`${label}: elegir color`} />
        <input
          id={`${id}-hex`}
          type="text"
          inputMode="text"
          spellCheck={false}
          autoComplete="off"
          value={shown}
          aria-invalid={invalid || undefined}
          onChange={(e) => {
            setText(e.target.value);
            const hex = normalizeHex(e.target.value);
            if (hex) onChange(hex);
          }}
          onBlur={() => setText(null)}
        />
      </div>
      {invalid && <span className="a-err">Usa un código como #D1106B</span>}
    </div>
  );
}
