import type { Review } from "@/lib/reviews";
import { reviewDate } from "@/lib/reviews";
import { Stars } from "./Stars";

type Texts = { verifiedLabel: string; replyLabel: string };

/** Una reseña aprobada. `product` agrega el nombre del producto (en la sección de Inicio). */
export function ReviewCard({ r, sf, product }: { r: Review; sf: Texts; product?: { name: string; href: string } }) {
  return (
    <article className="rcard">
      <div className="row between g3" style={{ alignItems: "center" }}>
        <Stars value={r.rating} />
        <time className="small muted" dateTime={r.createdAt}>{reviewDate(r.createdAt)}</time>
      </div>
      {product && <a className="rcard-prod" href={product.href}>{product.name}</a>}
      {r.body && <p className="body">{r.body}</p>}
      <p className="small rcard-who">
        <b>{r.author}</b>
        {r.verified && <span className="rcard-ok">{sf.verifiedLabel}</span>}
      </p>
      {r.reply && (
        <div className="rcard-reply">
          <p className="small"><b>{sf.replyLabel}</b></p>
          <p className="small muted">{r.reply}</p>
        </div>
      )}
    </article>
  );
}
