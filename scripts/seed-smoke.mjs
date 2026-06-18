// =============================================================================
// scripts/seed-smoke.mjs — THROWAWAY smoke-test seeder.
// Creates ONE auth user per role via the admin API (service role), then prints
// the 5 user UUIDs as JSON so a follow-up SQL step can wire up fixtures.
//
// Usage:  node scripts/seed-smoke.mjs
// Requires NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in .env.local.
// =============================================================================
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

// --- minimal .env.local loader (no dotenv dependency) -----------------------
const envText = readFileSync(new URL('../.env.local', import.meta.url), 'utf8');
const env = {};
for (const line of envText.split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (!m) continue;
  let v = m[2].trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    v = v.slice(1, -1);
  }
  env[m[1]] = v;
}

const url = env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const PASSWORD = 'Passw0rd!Test';
const USERS = [
  { email: 'superadmin@missionon.test', role: 'super_admin' },
  { email: 'admin@missionon.test', role: 'admin' },
  { email: 'coordinator@missionon.test', role: 'coordinator' },
  { email: 'mentor@missionon.test', role: 'mentor' },
  { email: 'learner@missionon.test', role: 'learner' },
];

async function findExistingByEmail(email) {
  // paginate through users (small DB; one page is plenty)
  for (let page = 1; page <= 5; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    const hit = data.users.find((u) => u.email === email);
    if (hit) return hit;
    if (data.users.length < 1000) break;
  }
  return null;
}

const ids = {};
for (const { email, role } of USERS) {
  let user = null;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { seed: 'smoke', role },
  });
  if (error) {
    // idempotent: if the user already exists, reuse it.
    if (/already/i.test(error.message) || error.status === 422) {
      user = await findExistingByEmail(email);
      if (!user) throw error;
    } else {
      throw error;
    }
  } else {
    user = data.user;
  }
  ids[role] = user.id;
  console.error(`auth user ${email} -> ${user.id}`);
}

// Print the 5 UUIDs as JSON on STDOUT (parsed by the SQL fixture step).
console.log(JSON.stringify(ids, null, 2));
