import Link from "next/link";
import type { CSSProperties } from "react";
import type { Tenant } from "@/lib/types";
import { asset } from "@/lib/assets";

/** `resolve`: para fotos que aún no tienen URL pública (subidas en la demo del panel). */
type Props = { tenant: Tenant; size?: "sm" | "lg"; href?: string; className?: string; resolve?: (src: string) => string | undefined };

export function Logo({ tenant, size, href, className = "", resolve }: Props) {
  const cls = `logo ${size ?? ""} ${tenant.logo.type === "image" ? "img" : ""} ${className}`.replace(/\s+/g, " ").trim();
  // El fondo del logo con letras va en el propio logo: así cada vista previa muestra el que se edita.
  const style = tenant.logo.type !== "image" && tenant.logo.background ? ({ "--logo-bg": tenant.logo.background } as CSSProperties) : undefined;
  const inner =
    tenant.logo.type === "image" && tenant.logo.image ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={resolve?.(tenant.logo.image) ?? asset(tenant.slug, tenant.logo.image)} alt="" />
    ) : (
      (tenant.logo.lines ?? []).map((l, i) => (
        <span key={i} className={`l-${i + 1}`} style={{ color: l.color }}>
          {l.text}
        </span>
      ))
    );
  if (href)
    return (
      <Link className={cls} style={style} href={href} aria-label={`${tenant.name}, inicio`}>
        {inner}
      </Link>
    );
  return (
    <span className={cls} style={style} role="img" aria-label={`Logo ${tenant.name}`}>
      {inner}
    </span>
  );
}
