/**
 * Turn a keyword string into safe ILIKE patterns.
 * - splits on spaces (max 5 words), every word must match the title OR the body
 * - escapes % _ \ so a user cannot inject wildcards
 */
export function toSearchPatterns(q: string | undefined): string[] {
  if (!q) return [];
  return q
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 5)
    .map((w) => `%${w.replace(/[\\%_]/g, (c) => `\\${c}`)}%`);
}
