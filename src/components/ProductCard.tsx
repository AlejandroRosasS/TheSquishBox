import Link from "next/link";
import type { Catalog, Product } from "@/lib/types";
import { asset } from "@/lib/assets";
import { isSoldOut, lineName, priceLabel, productBadge } from "@/lib/catalog";

type Props = { product: Product; catalog: Catalog; slug: string; currency: string; soldOutSuffix?: string; showBadge?: boolean };

export function ProductCard({ product: p, catalog, slug, currency, soldOutSuffix, showBadge = true }: Props) {
  const badge = showBadge ? productBadge(p) : null;
  return (
    <Link className="pcard" href={`/p/${p.id}`}>
      <div className={`ph r45 ${isSoldOut(p) ? "dim" : ""}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={asset(slug, p.images[0])} alt={p.name} loading="lazy" />
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
