import type { Metadata } from "next";
import { Suspense } from "react";
import { ReviewFormView } from "@/components/reviews/ReviewFormView";

export const metadata: Metadata = { title: "Deja tu reseña", robots: { index: false, follow: false } };

async function Form({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <ReviewFormView token={token} />;
}

export default function ReviewPage({ params }: { params: Promise<{ token: string }> }) {
  return (
    <Suspense fallback={<div style={{ minHeight: "60vh" }} />}>
      <Form params={params} />
    </Suspense>
  );
}
