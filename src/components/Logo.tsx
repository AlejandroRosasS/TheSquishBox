import Link from "next/link";
import type { Tenant } from "@/lib/types";
import { asset } from "@/lib/assets";

type Props = { tenant: Tenant; size?: "sm" | "lg"; href?: string; className?: string };

export function Logo({ tenant, size, href, className = "" }: Props) {
  const cls = `logo ${size ?? ""} ${tenant.logo.type === "image" ? "img" : ""} ${className}`.replace(/\s+/g, " ").trim();
  const inner =
    tenant.logo.type === "image" && tenant.logo.image ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={asset(tenant.slug, tenant.logo.image)} alt="" />
    ) : (
      (tenant.logo.lines ?? []).map((l, i) => (
        <span key={i} className={`l-${i + 1}`} style={{ color: l.color }}>
          {l.text}
        </span>
      ))
    );
  if (href)
    return (
      <Link className={cls} href={href} aria-label={`${tenant.name}, inicio`}>
        {inner}
      </Link>
    );
  return (
    <span className={cls} role="img" aria-label={`Logo ${tenant.name}`}>
      {inner}
    </span>
  );
}
