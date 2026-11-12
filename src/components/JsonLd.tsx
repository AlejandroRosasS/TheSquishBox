import { ldJson } from "@/lib/structuredData";

/** Datos estructurados para Google, renderizados en el servidor (van en el HTML inicial). */
export function JsonLd({ data }: { data: Record<string, unknown> | null }) {
  if (!data) return null;
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ldJson(data) }} />;
}
