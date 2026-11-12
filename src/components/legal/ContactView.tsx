import type { TenantBundle } from "@/tenants";
import { whatsappLink } from "@/lib/format";
import { businessOf, isPlaceholder } from "@/lib/legal";
import { isContactForm } from "@/lib/customOrder";
import { Rich } from "@/components/Rich";
import { ContactForm } from "@/components/party/ContactForm";
import { IconClock, IconInstagram, IconMail, IconPin, IconWhatsApp } from "@/components/Icons";

/**
 * Página Contacto: datos de la marca + formulario (motivo, mensaje y datos del cliente).
 * Razón social, RUC, Libro de reclamaciones y páginas legales van en el pie de página.
 * Sin datos del servidor: la usan la tienda y la vista previa del admin.
 */
export function ContactView({ bundle }: { bundle: TenantBundle }) {
  const { tenant, storefront: sf } = bundle;
  const b = businessOf(tenant, sf);
  const wa = whatsappLink(b.phone);
  const ig = `https://www.instagram.com/${tenant.instagram}/`;
  const mail = isPlaceholder(b.email) ? null : `mailto:${b.email}`;
  const withForm = tenant.customOrder.enabled && isContactForm(tenant);
  return (
    <div className="wrap" style={{ paddingBlock: "48px 96px" }}>
      <div className={`split ${withForm ? "wide-right" : ""}`}>
        <div className="stack g5">
          <p className="eyebrow">{sf.contact.eyebrow}</p>
          <h1 className="h1"><Rich text={sf.contact.title} /></h1>
          <p className="lead">{sf.contact.lead}</p>
          <div className="row g3 wrap-row">
            {wa && <a className="btn" href={wa} target="_blank" rel="noreferrer"><IconWhatsApp size="sm" /> Escríbenos por WhatsApp</a>}
            {mail && <a className="btn ghost" href={mail}><IconMail size="sm" /> Enviar un correo</a>}
          </div>
          <div className="contact-card stack g4">
            <ul className="contact-list">
              <li><IconWhatsApp size="sm" /><div><span className="label">WhatsApp y teléfono</span>{wa ? <a className="link" href={wa} target="_blank" rel="noreferrer">{b.phone}</a> : <span>{b.phone}</span>}</div></li>
              <li><IconMail size="sm" /><div><span className="label">Correo</span>{mail ? <a className="link" href={mail}>{b.email}</a> : <span>{b.email}</span>}</div></li>
              <li><IconInstagram size="sm" /><div><span className="label">Instagram</span><a className="link" href={ig} target="_blank" rel="noreferrer">@{tenant.instagram}</a></div></li>
              <li><IconPin size="sm" /><div><span className="label">Dirección</span><span>{b.address}</span></div></li>
              <li><IconClock size="sm" /><div><span className="label">Horario de atención</span><span>{b.hours}</span></div></li>
            </ul>
          </div>
        </div>
        {withForm && <ContactForm />}
      </div>
    </div>
  );
}
