import type { Metadata } from "next";
import type { CSSProperties } from "react";
import { getFileBundle } from "@/lib/tenant";
import { asset } from "@/lib/assets";
import { Logo } from "@/components/Logo";
import { whatsappLink } from "@/lib/format";
import type { Tenant } from "@/lib/types";

const FALLBACK = {
  metaDescription: "Nuestra tienda online está en construcción. Muy pronto podrás comprar aquí.",
  tape: "🚧 Tienda en construcción 🚧",
  title: "Muy pronto *abrimos*",
  lead: "Estamos preparando nuestra tienda online. Mientras tanto, mira las novedades y escríbenos por Instagram.",
  photos: [] as string[],
};

export function generateMetadata(): Metadata {
  const { tenant, storefront } = getFileBundle();
  return {
    title: { absolute: `${tenant.name} · Muy pronto` },
    description: (storefront.comingSoon ?? FALLBACK).metaDescription,
  };
}

/** "¡Estamos armando *la caja!*" → la parte entre asteriscos va en su propia línea, resaltada. */
function Title({ text }: { text: string }) {
  const m = text.match(/^(.*?)\*([^*]+)\*(.*)$/);
  if (!m) return <h1>{text}</h1>;
  return (
    <h1>
      {m[1]}
      <span>{m[2]}</span>
      {m[3]}
    </h1>
  );
}

function InstagramIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

const isSet = (v: string) => !!v && !v.startsWith("[");

/**
 * Variante sobria (storefront.comingSoon.layout = "editorial"): panel de marca con el logo
 * y columna de texto con tipografía de títulos de la marca. Sin animaciones ni transiciones.
 * Colores: los de la paleta activa (--primary, --bg, --accent…).
 */
function Editorial({ tenant, cs }: { tenant: Tenant; cs: typeof FALLBACK & { whatsappLabel?: string } }) {
  const hasIg = /^[A-Za-z0-9._]+$/.test(tenant.instagram);
  const wa = cs.whatsappLabel ? whatsappLink(tenant.whatsapp) : null;
  const m = cs.title.match(/^(.*?)\*([^*]+)\*(.*)$/);
  const place = [tenant.name, isSet(tenant.city) ? tenant.city : ""].filter(Boolean).join(" · ");
  return (
    <main className="soon-ed">
      <aside className="soon-ed-brand">
        <div className="soon-ed-mark">
          {tenant.logo.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={asset(tenant.slug, tenant.logo.image)} alt={tenant.name} width={220} height={220} />
          ) : (
            <Logo tenant={tenant} size="lg" />
          )}
        </div>
        {isSet(tenant.tagline) && <p className="soon-ed-tagline">{tenant.tagline}</p>}
      </aside>

      <section className="soon-ed-body">
        <div className="soon-ed-inner">
          <p className="soon-ed-eyebrow">{cs.tape}</p>
          <h1>
            {m ? (
              <>
                {m[1]}
                <em>{m[2]}</em>
                {m[3]}
              </>
            ) : (
              cs.title
            )}
          </h1>
          <span className="soon-ed-rule" aria-hidden>
            <i />
          </span>
          <p className="soon-ed-lead">{cs.lead}</p>
          {(hasIg || wa) && (
            <div className="soon-ed-actions">
              {hasIg && (
                <a className="soon-ed-btn" href={`https://instagram.com/${tenant.instagram}`} target="_blank" rel="noopener noreferrer">
                  <InstagramIcon size={18} />
                  <span>@{tenant.instagram}</span>
                </a>
              )}
              {wa && (
                <a className="soon-ed-link" href={wa} target="_blank" rel="noopener noreferrer">
                  {cs.whatsappLabel}
                </a>
              )}
            </div>
          )}
          {isSet(tenant.motto) && <p className="soon-ed-motto">{tenant.motto}</p>}
        </div>
        <footer className="soon-ed-foot">{place}</footer>
      </section>
    </main>
  );
}

export default function ComingSoon() {
  const { tenant, storefront } = getFileBundle();
  const cs = { ...FALLBACK, ...storefront.comingSoon };
  if (cs.layout === "editorial") return <Editorial tenant={tenant} cs={cs} />;
  const style = Object.fromEntries(Object.entries(cs.colors ?? {}).map(([k, v]) => [`--${k}`, v])) as CSSProperties;
  // Sin usuario de Instagram confirmado ("[por definir]") no mostramos el botón.
  const hasIg = /^[A-Za-z0-9._]+$/.test(tenant.instagram);
  return (
    <main className="soon" style={style}>
      <div className="soon-blob b1" aria-hidden />
      <div className="soon-blob b2" aria-hidden />
      <div className="soon-blob b3" aria-hidden />

      {cs.photos.length > 0 && (
        <div className="soon-photos" aria-hidden>
          {cs.photos.slice(0, 6).map((src, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={src} className={`p${i + 1}`} src={asset(tenant.slug, src)} alt="" />
          ))}
        </div>
      )}

      <section className="soon-card">
        {tenant.logo.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="soon-logo" src={asset(tenant.slug, tenant.logo.image)} alt={tenant.name} />
        ) : (
          <div className="soon-logo soon-logo-text">
            <Logo tenant={tenant} size="lg" />
          </div>
        )}
        <p className="soon-tape">{cs.tape}</p>
        <Title text={cs.title} />
        <p className="soon-lead">{cs.lead}</p>
        {hasIg && (
          <a className="soon-btn" href={`https://instagram.com/${tenant.instagram}`} target="_blank" rel="noopener noreferrer">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
              <rect x="3" y="3" width="18" height="18" rx="5" />
              <circle cx="12" cy="12" r="4" />
              <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
            </svg>
            @{tenant.instagram}
          </a>
        )}
        {!tenant.motto.startsWith("[") && <p className="soon-motto">{tenant.motto}</p>}
      </section>
    </main>
  );
}
