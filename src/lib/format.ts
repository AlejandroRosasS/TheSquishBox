export function formatPrice(n: number, currency = "PEN"): string {
  if (currency === "PEN") return `S/ ${n.toFixed(2)}`;
  return new Intl.NumberFormat("es-PE", { style: "currency", currency }).format(n);
}

export function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

/** Reemplaza {clave} en un texto del tenant. */
export function fill(text: string, vars: Record<string, string>): string {
  return text.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? "");
}

/** Devuelve un link de WhatsApp o null si el número aún es un placeholder. */
export function whatsappLink(phone: string, text?: string): string | null {
  const digits = phone.replace(/\D/g, "");
  if (/x/i.test(phone) || digits.length < 9) return null;
  return `https://wa.me/${digits}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
}
