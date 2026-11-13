import type { TenantBundle } from "@/tenants";
import { Rich } from "@/components/Rich";
import { ReviewCard } from "./ReviewCard";

/** Sección «Lo que dicen nuestros clientes» de Inicio. Apagada o sin reseñas aprobadas, no se muestra. */
export function HomeReviews({ bundle }: { bundle: TenantBundle }) {
  const sf = bundle.storefront.reviews;
  const names = new Map(bundle.catalog.products.filter((p) => p.status !== "draft").map((p) => [p.id, p.name]));
  // Primero las que tienen comentario: dicen más que solo estrellas.
  const list = (bundle.reviews ?? []).filter((r) => names.has(r.productId)).sort((a, b) => Number(!!b.body) - Number(!!a.body)).slice(0, 6);
  if (!sf?.showOnHome || !list.length) return null;
  return (
    <section className="section surface" id="resenas" data-edit="reviews">
      <div className="wrap stack g6">
        <div className="stack g2">
          <p className="eyebrow">{sf.eyebrow}</p>
          <h2 className="h2"><Rich text={sf.title} /></h2>
        </div>
        <div className="rgrid">
          {list.map((r) => <ReviewCard key={r.id} r={r} sf={sf} product={{ name: names.get(r.productId) as string, href: `/p/${r.productId}#resenas` }} />)}
        </div>
      </div>
    </section>
  );
}
