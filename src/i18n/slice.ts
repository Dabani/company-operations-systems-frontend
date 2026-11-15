/**
 * Splits one translation bundle file into a single language, so the build can ship each language as its own chunk.
 * The bundle files keep their format: `const en: D = {...}; const fr: D = {...}; ... export default { en, fr, rw, sw };`
 * Used by the Vite plugin in vite.config.ts and covered by slice.test.ts.
 */
export type LangCode = 'en' | 'fr' | 'rw' | 'sw';

export function sliceLanguage(source: string, lang: LangCode): string | null {
  const re = new RegExp(`const ${lang}: D = ([\\s\\S]*?);\\s*(?=(?:const (?:en|fr|rw|sw): D|export default))`);
  const hit = re.exec(source);
  return hit ? hit[1] : null;
}

/** Natural merge order of bundle files: bundle7, patch07a, bundle08 ... bundle12, bundle12b, bundle13, ... (later files override earlier ones). */
export function bundleOrder(paths: string[]): string[] {
  const key = (p: string): [number, string] => {
    const m = /(?:bundle|patch)0*(\d+)([a-z]*)\.ts/.exec(p);
    return m ? [Number(m[1]), m[2]] : [Number.MAX_SAFE_INTEGER, p];
  };
  return [...paths].sort((a, b) => { const [na, sa] = key(a); const [nb, sb] = key(b); return na - nb || sa.localeCompare(sb); });
}
