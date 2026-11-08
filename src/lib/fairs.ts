/** Ferias y eventos: fechas en días de Perú (AAAA-MM-DD, ambos incluidos) y costos fijos. */
export type FairCost = { label: string; amount: number };
export type Fair = {
  id: string;
  name: string;
  place: string;
  startsOn: string;
  endsOn: string;
  costs: FairCost[];
  note: string;
  createdAt: string;
};

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const ms = (day: string) => Date.parse(`${day}T12:00:00Z`);

/** Días que dura la feria (mínimo 1). */
export const fairDays = (f: Pick<Fair, "startsOn" | "endsOn">) => Math.max(1, Math.round((ms(f.endsOn) - ms(f.startsOn)) / 86_400_000) + 1);

export const fairFixed = (f: Pick<Fair, "costs">) => f.costs.reduce((a, c) => a + (Number(c.amount) || 0), 0);

/**
 * Feria vigente en un día. Misma regla que la base (fair_on en 0013_fairs.sql):
 * si dos se cruzan, gana la que empezó más tarde.
 */
export function fairOn<T extends Pick<Fair, "startsOn" | "endsOn" | "createdAt">>(fairs: T[], day: string | undefined): T | null {
  if (!day || !DAY.test(day)) return null;
  return (
    fairs
      .filter((f) => f.startsOn <= day && day <= f.endsOn)
      .sort((a, b) => b.startsOn.localeCompare(a.startsOn) || b.createdAt.localeCompare(a.createdAt))[0] ?? null
  );
}

const fmt = (day: string, withYear: boolean) =>
  new Intl.DateTimeFormat("es-PE", { day: "numeric", month: "short", ...(withYear ? { year: "numeric" } : {}), timeZone: "UTC" })
    .format(new Date(ms(day)))
    .replace(/\./g, "")
    .replace(/ de /g, " ");

/** «24 – 26 oct 2026 · 3 días» */
export function fairRange(f: Pick<Fair, "startsOn" | "endsOn">): string {
  const days = fairDays(f);
  const label = days === 1 ? "1 día" : `${days} días`;
  if (f.startsOn === f.endsOn) return `${fmt(f.startsOn, true)} · ${label}`;
  const [y1, m1] = f.startsOn.split("-");
  const [y2, m2] = f.endsOn.split("-");
  const start = y1 === y2 && m1 === m2 ? String(Number(f.startsOn.slice(8))) : fmt(f.startsOn, y1 !== y2);
  return `${start} – ${fmt(f.endsOn, true)} · ${label}`;
}

export type FairState = "active" | "scheduled" | "ended";
export function fairState(f: Pick<Fair, "startsOn" | "endsOn">, today: string): FairState {
  if (f.endsOn < today) return "ended";
  if (f.startsOn > today) return "scheduled";
  return "active";
}
/** Texto y clase de la etiqueta (mismas clases que las campañas). */
export const FAIR_STATE: Record<FairState, [string, string]> = {
  active: ["En curso", "publicado"],
  scheduled: ["Próxima", "nuevo"],
  ended: ["Terminada", "borrador"],
};
