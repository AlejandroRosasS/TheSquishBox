import Link from "next/link";
import type { Catalog, Product } from "@/lib/types";
import { Photo } from "@/components/Photo";
import { SLOTS } from "@/lib/media";
import { isSoldOut, lineName, priceLabel, productBadge, saleListPrice } from "@/lib/catalog";
import { formatPrice } from "@/lib/format";
import { Stars } from "@/components/reviews/Stars";
import { ratingText } from "@/lib/reviews";

type Props = { product: Product; catalog: Catalog; slug: string; currency: string; soldOutSuffix?: string; showBadge?: boolean };

export function ProductCard({ product: p, catalog, currency, soldOutSuffix, showBadge = true }: Props) {
  const badge = showBadge ? productBadge(p) : null;
  const was = isSoldOut(p) ? undefined : saleListPrice(p);
  return (
    <Link className="pcard" href={`/p/${p.id}`}>
      <div className={`ph r45 ${isSoldOut(p) ? "dim" : ""}`}>
        <Photo src={p.images[0]} alt={p.name} slot={SLOTS.product} loading="lazy" />
        {badge && <span className={`tag badge ${badge.cls}`}>{badge.text}</span>}
      </div>
      <div className="meta">
        <p className="coll">{lineName(catalog, p.line)}</p>
        <p className="name">{p.name}</p>
        {p.rating && (
          <p className="rate">
            <Stars value={p.rating.avg} size={13} label={`${ratingText(p.rating.avg)} de 5 estrellas, ${p.rating.count} ${p.rating.count === 1 ? "reseña" : "reseñas"}`} />
            <span aria-hidden="true">{ratingText(p.rating.avg)} ({p.rating.count})</span>
          </p>
        )}
        <p className="from">
          {priceLabel(p, currency, soldOutSuffix)}
          {was && <s className="was"><span className="visually-hidden">Precio regular </span>{formatPrice(was, currency)}</s>}
        </p>
      </div>
    </Link>
  );
}
