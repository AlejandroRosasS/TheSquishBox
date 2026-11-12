import Link from "next/link";
import { customOrderHref, isContactForm } from "@/lib/customOrder";
import type { TenantBundle } from "@/tenants";
import { Photo } from "@/components/Photo";
import { SLOTS } from "@/lib/media";
import { Rich } from "@/components/Rich";
import { ProductCard } from "@/components/ProductCard";
import { IconChevronRight, IconInstagram, IconStar } from "@/components/Icons";


/** Home de la tienda. Es isomórfica: la usa la página pública y la vista previa del admin. */
export function HomeView({ bundle }: { bundle: TenantBundle }) {
  const { tenant, catalog, storefront: sf } = bundle;
  const featured = sf.featured.productIds
    .map((id) => catalog.products.find((p) => p.id === id))
    .filter((p) => p && p.status !== "draft") as typeof catalog.products;
  const soldOutSuffix = tenant.customOrder.enabled && !isContactForm(tenant) ? `pídela ${tenant.customOrder.label.toLowerCase()}` : undefined;
  const ig = `https://www.instagram.com/${tenant.instagram}/`;
  const models = sf.models.photos
    ? sf.models.photos.map((m) => ({ name: m.alt, image: m.image }))
    : (catalog.collectibleModels?.items.slice(0, sf.models.max) ?? []);

  return (
    <>
      <section className="hero" data-edit="hero">
        <Photo src={sf.hero.image} srcMobile={sf.hero.imageMobile} alt={sf.hero.alt} slot={SLOTS.hero} fetchPriority="high" />
        <div className="wrap hero-in stack g4">
          <p className="eyebrow">{sf.hero.eyebrow}</p>
          <h1 className="display" style={{ maxWidth: 760 }}><Rich text={sf.hero.title} /></h1>
          <p className="lead" style={{ color: "#FFFFFF", opacity: 0.92, maxWidth: 560 }}>{sf.hero.lead}</p>
          <div className="row g3 wrap-row" style={{ marginTop: 8 }}>
            <Link className="btn light" href={sf.hero.primaryCta.href}>{sf.hero.primaryCta.label}</Link>
            {tenant.customOrder.enabled && (
              <Link className="btn" href={sf.hero.secondaryCta.href} style={{ background: "transparent", borderColor: "#FFFFFF", color: "#FFFFFF" }}>
                {sf.hero.secondaryCta.label}
              </Link>
            )}
          </div>
        </div>
      </section>

      <section className="section tight" data-edit="highlights">
        <div className="wrap stack g7">
          <nav className="hls" aria-label="Accesos rápidos">
            {sf.highlights.map((h, i) => (
              <Link className="hl" href={h.href} key={i}>
                <span className="c"><IconStar /></span>
                {h.label}
              </Link>
            ))}
          </nav>
          <div className="tiles">
            {sf.tiles.map((t, i) => (
              <Link className="tile" href={t.href} key={i}>
                <Photo src={t.image} srcMobile={t.imageMobile} alt={t.alt} slot={SLOTS.tiles} loading="lazy" />
                <div className="tile-in">
                  <span className="eyebrow" style={{ color: "#FFFFFF" }}>{t.eyebrow}</span>
                  <span className="h3">{t.title}</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="section" style={{ paddingTop: 32 }} data-edit="featured">
        <div className="wrap stack g6">
          <div className="row between" style={{ alignItems: "flex-end", gap: 16 }}>
            <div className="stack g2">
              <p className="eyebrow">{sf.featured.eyebrow}</p>
              <h2 className="h2"><Rich text={sf.featured.title} /></h2>
            </div>
            <Link className="textlink only-d" href="/tienda">
              {sf.featured.viewAll} <IconChevronRight size="sm" />
            </Link>
          </div>
          <div className="pgrid">
            {featured.map((p) => (
              <ProductCard key={p.id} product={p} catalog={catalog} slug={tenant.slug} currency={tenant.currency} soldOutSuffix={soldOutSuffix} />
            ))}
          </div>
          <Link className="btn ghost block only-m" href="/tienda">{sf.featured.viewAllMobile}</Link>
        </div>
      </section>

      {tenant.customOrder.enabled && (
        <section className="section primary-band" data-edit="partyBand">
          <div className="wrap split">
            <div className="ph r45" style={{ borderRadius: 24 }}>
              <Photo src={sf.partyBand.image} srcMobile={sf.partyBand.imageMobile} alt={sf.partyBand.alt} slot={SLOTS.partyBand} loading="lazy" />
            </div>
            <div className="stack g5">
              <p className="eyebrow">{sf.partyBand.eyebrow}</p>
              <h2 className="h1"><Rich text={sf.partyBand.title} /></h2>
              <p className="lead">{sf.partyBand.lead}</p>
              <ol className="stack g3" style={{ margin: "8px 0 12px", padding: 0, listStyle: "none" }}>
                {sf.partyBand.steps.map((s, i) => (
                  <li className="row g3" key={i}>
                    <span className="badge" style={{ background: "transparent", color: "var(--on-primary)", borderColor: "color-mix(in oklab, var(--on-primary) 40%, transparent)" }}>{i + 1}</span>
                    <span>{s}</span>
                  </li>
                ))}
              </ol>
              <div><Link className="btn light" href={customOrderHref(tenant)}>{sf.partyBand.cta}</Link></div>
            </div>
          </div>
        </section>
      )}

      <section className="section" data-edit="inside">
        <div className="wrap split">
          <div className="stack g5">
            <p className="eyebrow">{sf.inside.eyebrow}</p>
            <h2 className="h1"><Rich text={sf.inside.title} /></h2>
            <hr className="rule" />
            <p className="lead">{sf.inside.lead}</p>
            <p className="body muted">{sf.inside.body}</p>
          </div>
          <div className="ph r45" style={{ borderRadius: 24 }}>
            <Photo src={sf.inside.image} srcMobile={sf.inside.imageMobile} alt={sf.inside.alt} slot={SLOTS.inside} loading="lazy" />
          </div>
        </div>
      </section>

      {models.length > 0 && (
        <section className="section surface" id="modelos" data-edit="models">
          <div className="wrap stack g6">
            <div className="row between wrap-row" style={{ alignItems: "flex-end", gap: 16 }}>
              <div className="stack g2">
                <p className="eyebrow">{sf.models.eyebrow}</p>
                <h2 className="h2"><Rich text={sf.models.title} /></h2>
              </div>
              <a className="textlink" href={ig} target="_blank" rel="noreferrer">
                <IconInstagram size="sm" />@{tenant.instagram}
              </a>
            </div>
            <div className="ugc">
              {models.map((m, i) => (
                <div className="ph r11" key={`${m.name}-${i}`}>
                  <Photo src={m.image} alt={m.name} slot={SLOTS.models} loading="lazy" />
                </div>
              ))}
            </div>
            <p className="small muted">{sf.models.footnote}</p>
          </div>
        </section>
      )}

      <section className="section" id="tips" data-edit="tips">
        <div className="wrap stack g6">
          <div className="stack g2">
            <p className="eyebrow">{sf.tips.eyebrow}</p>
            <h2 className="h2"><Rich text={sf.tips.title} /></h2>
          </div>
          <div className="tips">
            {sf.tips.items.map((t, i) => (
              <div className="tip" key={i}>
                <span className="num">{String(i + 1).padStart(2, "0")}</span>
                <h3 className="h4">{t.title}</h3>
                <p className="small muted">{t.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
