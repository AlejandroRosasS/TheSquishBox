import type { Metadata } from "next";
import { getFileBundle } from "@/lib/tenant";
import { asset } from "@/lib/assets";

export const metadata: Metadata = {
  title: { absolute: "The Squish Box · Muy pronto" },
  description: "Nuestra tienda online está en construcción. Muy pronto podrás comprar tus mystery squishies aquí.",
};

const PHOTOS = [
  { src: "img/fresa-gigante.jpg", cls: "p1" },
  { src: "img/ajolote.jpg", cls: "p2" },
  { src: "img/jelly-cubes.jpg", cls: "p3" },
  { src: "img/mandarina.jpg", cls: "p4" },
  { src: "img/gatitos.jpg", cls: "p5" },
  { src: "img/patitas.jpg", cls: "p6" },
];

export default function ComingSoon() {
  const { tenant } = getFileBundle();
  const ig = `https://instagram.com/${tenant.instagram}`;
  return (
    <main className="soon">
      <div className="soon-blob b1" aria-hidden />
      <div className="soon-blob b2" aria-hidden />
      <div className="soon-blob b3" aria-hidden />

      <div className="soon-photos" aria-hidden>
        {PHOTOS.map((p) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={p.src} className={p.cls} src={asset(tenant.slug, p.src)} alt="" />
        ))}
      </div>

      <section className="soon-card">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="soon-logo" src={asset(tenant.slug, "img/logo.jpg")} alt={tenant.name} />
        <p className="soon-tape">🚧 Tienda en construcción 🚧</p>
        <h1>
          ¡Estamos armando <span>la caja!</span>
        </h1>
        <p className="soon-lead">
          Muy pronto vas a poder comprar tus mystery squishies aquí. Mientras tanto, mira las novedades y escríbenos por
          Instagram.
        </p>
        <a className="soon-btn" href={ig} target="_blank" rel="noopener noreferrer">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
            <rect x="3" y="3" width="18" height="18" rx="5" />
            <circle cx="12" cy="12" r="4" />
            <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
          </svg>
          @{tenant.instagram}
        </a>
        <p className="soon-motto">{tenant.motto}</p>
      </section>
    </main>
  );
}
