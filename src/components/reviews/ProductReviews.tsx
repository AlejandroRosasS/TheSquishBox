import type { Product } from "@/lib/types";
import type { Review } from "@/lib/reviews";
import { countText, ratingText } from "@/lib/reviews";
import { Rich } from "@/components/Rich";
import type { Storefront } from "@/lib/types";
import { Stars } from "./Stars";
import { ReviewCard } from "./ReviewCard";

/** Bloque de reseñas en la página del producto. Sin reseñas aprobadas no se muestra nada. */
export function ProductReviews({ product, reviews, sf }: { product: Product; reviews: Review[]; sf: Storefront["reviews"] }) {
  const mine = reviews.filter((r) => r.productId === product.id);
  if (!product.rating || !mine.length) return null;
  return (
    <section className="stack g5 reviews" id="resenas" aria-labelledby="resenas-h">
      <div className="row g4 wrap-row" style={{ alignItems: "center" }}>
        <h2 className="h2" id="resenas-h"><Rich text={sf.productTitle} /></h2>
        <span className="row g2" style={{ alignItems: "center" }}>
          <Stars value={product.rating.avg} size={20} />
          <span className="body"><b>{ratingText(product.rating.avg)}</b> · {countText(product.rating.count)}</span>
        </span>
      </div>
      <div className="rgrid">
        {mine.slice(0, 12).map((r) => <ReviewCard key={r.id} r={r} sf={sf} />)}
      </div>
    </section>
  );
}
