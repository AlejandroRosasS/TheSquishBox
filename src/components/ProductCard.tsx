import Link from "next/link";
import type { Catalog, Product } from "@/lib/types";
import { Photo } from "@/components/Photo";
import { SLOTS } from "@/lib/media";
import { isSoldOut, lineName, priceLabel, productBadge } from "@/lib/catalog";

type Props = { product: Product; catalog: Catalog; slug: string; currency: string; soldOutSuffix?: string; showBadge?: boolean };

export function ProductCard({ product: p, catalog, currency, soldOutSuffix, showBadge = true }: Props) {
  const badge = showBadge ? productBadge(p) : null;
  return (
    <Link className="pcard" href={`/p/${p.id}`}>
      <div className={`ph r45 ${isSoldOut(p) ? "dim" : ""}`}>
        <Photo src={p.images[0]} alt={p.name} slot={SLOTS.product} loading="lazy" />
        {badge && <span className={`tag badge ${badge.cls}`}>{badge.text}</span>}
      </div>
      <div className="meta">
        <p className="coll">{lineName(catalog, p.line)}</p>
        <p className="name">{p.name}</p>
        <p className="from">{priceLabel(p, currency, soldOutSuffix)}</p>
      </div>
    </Link>
  );
}
