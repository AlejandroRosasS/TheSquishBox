import Link from "next/link";
import type { ReactNode } from "react";
import type { TenantBundle } from "@/tenants";
import { Logo } from "./Logo";
import { IconInstagram, IconWhatsApp } from "./Icons";
import { whatsappLink } from "@/lib/format";

/** `year` lo pasa el layout del servidor (cacheado); en la vista previa del admin se calcula en el cliente. */
export function Footer({ bundle, year }: { bundle: TenantBundle; year?: ReactNode }) {
  const { tenant, storefront } = bundle;
  const ig = `https://www.instagram.com/${tenant.instagram}/`;
  const wa = whatsappLink(tenant.whatsapp);
  return (
    <footer className="footer">
      <div className="wrap">
        <div className="cols">
          <div className="stack g4">
            <Logo tenant={tenant} size="lg" />
            <p className="small" style={{ maxWidth: 300, opacity: 0.85 }}>{storefront.footer.about}</p>
            <div className="social">
              <a href={ig} aria-label="Instagram" target="_blank" rel="noreferrer">
                <IconInstagram size="sm" />
              </a>
              <a href={wa ?? "#"} aria-label="WhatsApp" target={wa ? "_blank" : undefined} rel="noreferrer">
                <IconWhatsApp size="sm" />
              </a>
            </div>
          </div>
          <div>
            <h4>Tienda</h4>
            <ul>
              {storefront.footer.shop.map((l, i) => (
                <li key={i}><Link href={l.href}>{l.label}</Link></li>
              ))}
            </ul>
          </div>
          <div>
            <h4>Ayuda</h4>
            <ul>
              {storefront.footer.help.map((l, i) => (
                <li key={i}><Link href={l.href}>{l.label}</Link></li>
              ))}
            </ul>
          </div>
          <div>
            <h4>Contacto</h4>
            <ul>
              <li><a href={ig} target="_blank" rel="noreferrer">@{tenant.instagram}</a></li>
              <li><a href={wa ?? "#"}>WhatsApp {wa ? tenant.whatsapp : `[${tenant.whatsapp}]`}</a></li>
              <li>{tenant.city}</li>
            </ul>
          </div>
        </div>
        <div className="legal">
          <span>© {year ?? new Date().getFullYear()} {tenant.name} · {storefront.footer.legal}</span>
          <span>{storefront.footer.legalLinks}</span>
        </div>
      </div>
    </footer>
  );
}
