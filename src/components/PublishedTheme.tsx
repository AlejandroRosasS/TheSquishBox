"use client";

import { useEffect } from "react";
import { useStore } from "./StoreContext";
import { applyPublishedTheme } from "@/lib/publishedTheme";

/** Mantiene la tienda al día si publican otra paleta desde el admin (en otra pestaña). */
export function PublishedTheme() {
  const { tenant } = useStore();
  useEffect(() => {
    const apply = () => applyPublishedTheme(tenant.slug);
    window.addEventListener("storage", apply);
    return () => window.removeEventListener("storage", apply);
  }, [tenant.slug]);
  return null;
}
