// Read the feedback board (service role). Usage: node scripts/read-feedback.mjs [status]
// Default: shows items with status 'new' (or null). Pass 'all' to list everything.
import { readFileSync } from 'node:fs';

const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith('#') && l.includes('='))
    .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()])
);

const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY;
const filter = process.argv[2] || 'new';

const qs =
  filter === 'all'
    ? 'select=*&order=created_at.desc&limit=100'
    : `select=*&or=(status.eq.${filter},status.is.null)&order=created_at.desc&limit=100`;

const res = await fetch(`${url}/rest/v1/feedback?${qs}`, {
  headers: { apikey: key, authorization: `Bearer ${key}` },
});
if (!res.ok) {
  console.error('Failed:', res.status, await res.text());
  process.exit(1);
}
const rows = await res.json();
console.log(`${rows.length} row(s) (filter: ${filter})\n`);
for (const r of rows) {
  console.log('----------------------------------------');
  for (const [k, v] of Object.entries(r)) {
    if (v == null || v === '') continue;
    const val = typeof v === 'object' ? JSON.stringify(v) : String(v);
    console.log(`${k}: ${val.length > 600 ? val.slice(0, 600) + '…' : val}`);
  }
}
