import { MANUAL_CHANNELS, PAY_METHODS, SALES_COLUMNS, type CatalogLite } from "./csv";

export type PromptCampaign = { name: string; from: string; to: string; prices: { productId: string; variantId: string; price: number }[] };

const soles = (n: number) => `S/ ${n.toFixed(2)}`;

/**
 * Instrucciones para pegar en Claude o ChatGPT: con esto la IA convierte lo que le cuenten
 * («vendí 2 ajolotes a María por IG, pagó con Yape») en el CSV que acepta el admin y el bot.
 * Lleva el catálogo y las campañas del momento, por eso se copia de nuevo cuando cambian.
 */
export function salesPrompt(opts: { brand: string; catalog: CatalogLite; campaigns: PromptCampaign[]; today: string }): string {
  const products = opts.catalog.products
    .map((p) => {
      const opts2 = p.variants.map((v) => `«${v.label}» ${soles(v.price)}`).join(" · ");
      return `- ${p.id} = ${p.name}${p.variants.length > 1 ? ` (opciones: ${opts2})` : ` (${soles(p.variants[0]?.price ?? 0)}, sin opciones)`}`;
    })
    .join("\n");
  const name = (pid: string, vid: string) => {
    const p = opts.catalog.products.find((x) => x.id === pid);
    const v = p?.variants.find((x) => x.id === vid);
    return p ? `${p.name}${p.variants.length > 1 && v ? ` «${v.label}»` : ""}` : pid;
  };
  const campaigns = opts.campaigns.length
    ? opts.campaigns.map((c) => `- «${c.name}», del ${c.from} al ${c.to}: ${c.prices.map((x) => `${name(x.productId, x.variantId)} ${soles(x.price)}`).join(" · ")}`).join("\n")
    : "- No hay campañas activas ni programadas.";

  return `Eres mi asistente para registrar las ventas manuales de ${opts.brand} (ventas por Instagram/WhatsApp, ferias, colegios, etc.).
Te voy a contar ventas con mis palabras, incluso varias a la vez o con fotos de mis apuntes. Tu trabajo es devolverme un CSV que luego subo al sistema.

Hoy es ${opts.today} (hora de Perú). Si te digo «ayer» o «el sábado», calcula la fecha.

FORMATO (respeta exactamente esta primera fila y el orden de columnas):
${SALES_COLUMNS.join(",")}

Reglas:
- Una fila por producto vendido. Si una venta tiene 2 productos distintos, son 2 filas con el mismo número en «venta».
- fecha: AAAA-MM-DD.
- venta: un número para agrupar las filas de una misma venta (1, 2, 3…).
- canal: solo ig (Instagram, DM o WhatsApp), feria (ferias y eventos) u otros (colegios, referidos, empresas). Nunca web.
- cliente: nombre o @usuario, si lo sé. Si no, vacío.
- pago: ${PAY_METHODS.join(", ")}.
- producto: el código de la lista de abajo (lo que va antes del «=»).
- opcion: el nombre de la opción tal como está en la lista. Vacío si el producto no tiene opciones.
- cantidad: número entero.
- precio: precio unitario cobrado, solo el número con punto decimal (69.00). Déjalo VACÍO si se cobró el precio normal o el de la campaña de ese día: el sistema lo pone solo. Llénalo solo si cobré otro precio (descuento o precio especial).
- campana: vacío. Solo si te digo que fue con una campaña, pon su nombre.
- delivery_cobrado y delivery_costo: lo que le cobré al cliente por el envío y lo que me costó, solo en la primera fila de la venta. Vacío si no hubo delivery.
- nota: cualquier detalle útil, corto y sin comas.
- No inventes nada: si falta un dato obligatorio (fecha, producto, opción cuando hay varias, cantidad), pregúntame antes de armar el CSV.
- Responde con el CSV dentro de un bloque de código y, debajo, un resumen de una línea por venta con su total, para que lo revise.

PRODUCTOS (código = nombre):
${products}

CAMPAÑAS DE OFERTA (el sistema aplica su precio solo; no lo escribas en «precio»):
${campaigns}

Canales válidos: ${MANUAL_CHANNELS.map(([k, l]) => `${k} (${l})`).join(", ")}.

Si entendiste, respóndeme solo: «Listo, cuéntame las ventas».`;
}
