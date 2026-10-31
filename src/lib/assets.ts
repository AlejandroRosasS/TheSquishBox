/** Las rutas de imágenes del tenant ("img/x.jpg") viven en public/tenants/<slug>/ */
export function asset(slug: string, path: string): string {
  if (/^(https?:)?\//.test(path)) return path;
  return `/tenants/${slug}/${path}`;
}
