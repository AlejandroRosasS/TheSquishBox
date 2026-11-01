"use client";

import { useMemo } from "react";
import { dataKey, usePersisted } from "@/lib/admin/storage";
import type { IgPost } from "@/lib/admin/types";
import { useAdmin } from "../AdminContext";

type IgState = { sel: string[]; converted: string[]; hidden: string[]; syncedAt?: string };

/** Bandeja de posts de Instagram (demo): selección, convertidos y ocultos. */
export function useIg() {
  const { bundle, demo } = useAdmin();
  const [st, setSt] = usePersisted<IgState>(dataKey(bundle.tenant.slug, "ig"), { sel: [], converted: [], hidden: [] });
  const posts: IgPost[] = useMemo(
    () => demo.igPosts.filter((p) => !st.hidden.includes(p.id)).map((p) => (st.converted.includes(p.id) ? { ...p, kind: "done" as const } : p)),
    [demo.igPosts, st.converted, st.hidden],
  );
  return { posts, st, setSt };
}
