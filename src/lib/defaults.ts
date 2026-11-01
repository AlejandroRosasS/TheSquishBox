const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/** Completa `value` con las claves que falten de `defaults`, recorriendo objetos (los arreglos no se mezclan). */
export function withDefaults<T>(defaults: T, value: T): T {
  if (!isObj(defaults) || !isObj(value)) return value ?? defaults;
  const out: Record<string, unknown> = { ...defaults };
  for (const [k, v] of Object.entries(value)) out[k] = k in defaults ? withDefaults(defaults[k], v) : v;
  return out as T;
}

