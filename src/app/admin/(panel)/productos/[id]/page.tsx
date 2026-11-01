import type { Metadata } from "next";
import { Suspense } from "react";
import { ProductEditorView } from "@/components/admin/screens/ProductEditorView";

export const metadata: Metadata = { title: "Editor de producto" };

export default function ProductEditorPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<main className="a-main" id="contenido"><p className="a-sub">Cargando…</p></main>}>
      <ProductEditorView params={params} />
    </Suspense>
  );
}
