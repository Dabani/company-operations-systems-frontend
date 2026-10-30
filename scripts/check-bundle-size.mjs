// Performance gate (developer guide 15.1): fail the build when the JavaScript needed for first load grows past the budget.
// Initial load = the entry script plus its modulepreload chunks listed in dist/index.html, measured gzipped.
import { readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';

const budgetKb = Number(process.env.INITIAL_JS_BUDGET_KB ?? 400);
const html = readFileSync('dist/index.html', 'utf8');
const files = [...new Set([...html.matchAll(/(?:src|href)="\/(assets\/[^"]+\.js)"/g)].map((m) => m[1]))];
let total = 0;
for (const f of files) {
  const kb = gzipSync(readFileSync(`dist/${f}`)).length / 1024;
  total += kb;
  console.log(`${kb.toFixed(1).padStart(7)} KB gz  ${f}`);
}
console.log(`\nInitial JavaScript: ${total.toFixed(1)} KB gzipped (budget ${budgetKb} KB)`);
if (total > budgetKb) { console.error('Over budget: a heavy library is probably being imported eagerly (check manualChunks / lazy routes).'); process.exit(1); }
