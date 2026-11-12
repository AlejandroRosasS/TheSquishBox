import Link from "next/link";
import type { ReactNode } from "react";
import type { TenantBundle } from "@/tenants";
import { Logo } from "./Logo";
import { IconBook, IconInstagram, IconMail, IconWhatsApp } from "./Icons";
import { plainText, whatsappLink } from "@/lib/format";
import { businessOf, COMPLAINTS_ROUTE, isPlaceholder, isShown, LEGAL_ROUTES } from "@/lib/legal";

/** `year` lo pasa el layout del servidor (cacheado); en la vista previa del admin se calcula en el cliente. */
export function Footer({ bundle, year }: { bundle: TenantBundle; year?: ReactNode }) {
  const { tenant, storefront } = bundle;
  const ig = `https://www.instagram.com/${tenant.instagram}/`;
  const b = businessOf(tenant, storefront);
  // Lo que se apagó en Textos › Contacto y empresa no se muestra (razón social y RUC siempre).
  const showIg = isShown(b, "instagram");
  const showPhone = isShown(b, "phone");
  const showMail = isShown(b, "email");
  const showAddress = isShown(b, "address");
  const wa = showPhone ? whatsappLink(tenant.whatsapp) : null;
  const mail = !showMail || isPlaceholder(b.email) ? null : `mailto:${b.email}`;
  const legal = storefront.legalPages;
  return (
    <footer className="footer">
      <div className="wrap">
        <div className="cols">
          <div className="stack g4">
            <Logo tenant={tenant} size="lg" />
            <p className="small" style={{ maxWidth: 300, opacity: 0.85 }}>{storefront.footer.about}</p>
            <div className="social">
              {showIg && (
                <a href={ig} aria-label="Instagram" target="_blank" rel="noreferrer">
                  <IconInstagram size="sm" />
                </a>
              )}
              {wa && (
                <a href={wa} aria-label="WhatsApp" target="_blank" rel="noreferrer">
                  <IconWhatsApp size="sm" />
                </a>
              )}
              {mail && (
                <a href={mail} aria-label="Correo">
                  <IconMail size="sm" />
                </a>
              )}
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
              {showIg && <li><a href={ig} target="_blank" rel="noreferrer">@{tenant.instagram}</a></li>}
              {showPhone && <li>{wa ? <a href={wa} target="_blank" rel="noreferrer">WhatsApp {b.phone}</a> : <>WhatsApp {b.phone}</>}</li>}
              {showMail && <li>{mail ? <a href={mail}>{b.email}</a> : b.email}</li>}
              {showAddress && <li>{isPlaceholder(b.address) ? tenant.city : b.address}</li>}
            </ul>
          </div>
        </div>
        <div className="legal">
          <span>© {year ?? new Date().getFullYear()} {tenant.name} · {b.legalName} · RUC {b.ruc}</span>
          <nav className="legal-links" aria-label="Información legal">
            <Link href={LEGAL_ROUTES.terms}>{legal.terms.title}</Link>
            <Link href={LEGAL_ROUTES.returns}>{legal.returns.title}</Link>
            <Link href={LEGAL_ROUTES.privacy}>{legal.privacy.title}</Link>
          </nav>
        </div>
        <Link className="book-link" href={COMPLAINTS_ROUTE}>
          <IconBook size="sm" />
          <span>{plainText(storefront.complaints.title)}</span>
        </Link>
      </div>
    </footer>
  );
}
