/** Año actual, cacheado (Cache Components no permite new Date() suelto en el servidor). */
export async function Year() {
  "use cache";
  return <>{new Date().getFullYear()}</>;
}
