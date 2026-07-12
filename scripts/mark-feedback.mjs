// Set feedback status. Usage: node scripts/mark-feedback.mjs <status> <id> [id...]
import { readFileSync } from 'node:fs';

const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith('#') && l.includes('='))
    .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()])
);

const [status, ...ids] = process.argv.slice(2);
if (!['new', 'acknowledged', 'actioned'].includes(status) || ids.length === 0) {
  console.error('Usage: node scripts/mark-feedback.mjs <new|acknowledged|actioned> <id> [id...]');
  process.exit(1);
}

const res = await fetch(
  `${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/feedback?id=in.(${ids.join(',')})`,
  {
    method: 'PATCH',
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      'content-type': 'application/json',
      prefer: 'return=representation',
    },
    body: JSON.stringify({ status }),
  }
);
const rows = await res.json();
if (!res.ok) {
  console.error('Failed:', res.status, JSON.stringify(rows));
  process.exit(1);
}
console.log(`Updated ${rows.length} row(s) to '${status}'.`);
