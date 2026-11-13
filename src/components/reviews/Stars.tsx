import { ratingText } from "@/lib/reviews";

const PATH = "M12 2.8l2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17.2l-5.7 3.1 1.2-6.4-4.7-4.4 6.4-.8z";

/** Estrellas de solo lectura (0 a 5, acepta medios). El texto para lectores de pantalla va en `label`. */
export function Stars({ value, size = 16, label }: { value: number; size?: number; label?: string }) {
  const pct = Math.max(0, Math.min(100, (value / 5) * 100));
  return (
    <span className="stars" role="img" aria-label={label ?? `${ratingText(value)} de 5 estrellas`} style={{ height: size }}>
      <span className="stars-row" aria-hidden="true">{[0, 1, 2, 3, 4].map((i) => <svg key={i} viewBox="0 0 24 24" width={size} height={size}><path d={PATH} /></svg>)}</span>
      <span className="stars-row on" aria-hidden="true" style={{ width: `${pct}%` }}>{[0, 1, 2, 3, 4].map((i) => <svg key={i} viewBox="0 0 24 24" width={size} height={size}><path d={PATH} /></svg>)}</span>
    </span>
  );
}
