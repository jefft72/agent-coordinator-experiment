/**
 * Prefix a public path with the deployment base so assets resolve under
 * both "/" and a project page such as "/agent-coordinator-experiment/".
 */
export function withBase(path: string): string {
  const base = import.meta.env.BASE_URL;
  const trimmed = path.startsWith('/') ? path.slice(1) : path;
  return base.endsWith('/') ? `${base}${trimmed}` : `${base}/${trimmed}`;
}
