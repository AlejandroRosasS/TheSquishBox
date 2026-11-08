import type { Metadata } from "next";
import type { CSSProperties } from "react";
import { getFileBundle } from "@/lib/tenant";
import { asset } from "@/lib/assets";
import { Logo } from "@/components/Logo";

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

export default function ComingSoon() {
  const { tenant, storefront } = getFileBundle();
  const cs = { ...FALLBACK, ...storefront.comingSoon };
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
