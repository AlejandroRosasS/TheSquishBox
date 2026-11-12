import Link from "next/link";
import { Fragment, type ReactNode } from "react";

/**
 * Texto con marcas mínimas desde el tenant:
 * *énfasis* → <em>, **negrita** → <b>, [texto](/ruta) → link (los de otra web abren en otra pestaña), salto de línea → <br>.
 */
export function Rich({ text }: { text: string }): ReactNode {
  const lines = text.split("\n");
  return lines.map((line, li) => (
    <Fragment key={li}>
      {li > 0 && <br />}
      {line.split(/(\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]+\]\([^)]+\))/g).map((part, i) => {
        if (!part) return null;
        if (part.startsWith("**")) return <b key={i}>{part.slice(2, -2)}</b>;
        if (part.startsWith("*")) return <em key={i}>{part.slice(1, -1)}</em>;
        const m = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
        if (m && /^https?:\/\//.test(m[2]))
          return (
            <a key={i} className="link" href={m[2]} target="_blank" rel="noopener noreferrer">
              {m[1]}
            </a>
          );
        if (m)
          return (
            <Link key={i} className="link" href={m[2]}>
              {m[1]}
            </Link>
          );
        return <Fragment key={i}>{part}</Fragment>;
      })}
    </Fragment>
  ));
}
