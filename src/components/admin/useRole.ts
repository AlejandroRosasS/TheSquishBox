"use client";

import { useDb } from "./DbContext";
import type { Role } from "@/lib/team/roles";

/** Perfil de quien usa el panel en esta marca. En la demo (sin base) se ve todo, como Dueño. */
export function useRole(): Role {
  const db = useDb();
  return db?.state.phase === "ready" ? db.state.role : "owner";
}
