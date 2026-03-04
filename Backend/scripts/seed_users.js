import path from 'path';
import dotenv from 'dotenv';
import { Pool } from 'pg';
import bcrypt from 'bcrypt';
import { fileURLToPath } from 'url';

// __dirname for ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from Backend/.env (script lives in Backend/scripts)
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

let supabaseClient = null;
let usingSupabase = false;
try {
  if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY) {
    // Lazy import to avoid hard dependency errors if package is missing
    const { createClient } = await import('@supabase/supabase-js');
    supabaseClient = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false }
    });
    usingSupabase = true;
    console.log('🔗 Using Supabase REST client for seeding');
  }
} catch (e) {
  console.warn('⚠️ @supabase/supabase-js not available or failed to init — falling back to direct PG. Run `npm i @supabase/supabase-js` to enable Supabase client.');
}

// Database connection configuration
const poolConfig = {};
if (process.env.DATABASE_URL) {
  poolConfig.connectionString = process.env.DATABASE_URL;
} else {
  poolConfig.host = process.env.PGHOST || 'localhost';
  poolConfig.user = process.env.PGUSER || process.env.DB_USER;
  poolConfig.password = process.env.PGPASSWORD || process.env.DB_PASS;
  poolConfig.database = process.env.PGDATABASE || process.env.DB_NAME;
  poolConfig.port = process.env.PGPORT ? Number(process.env.PGPORT) : (process.env.DB_PORT ? Number(process.env.DB_PORT) : 5432);
}

// Enable SSL for remote/Postgres-as-a-service (Supabase) when appropriate
if (poolConfig.connectionString) {
  const connLower = String(poolConfig.connectionString).toLowerCase();
  if (connLower.includes('supabase.co') || process.env.PGSSLMODE === 'require' || process.env.SUPABASE_DB_SSL === 'true') {
    poolConfig.ssl = { rejectUnauthorized: false };
  }
} else if (poolConfig.host && !['localhost', '127.0.0.1', '::1'].includes(poolConfig.host)) {
  // If host looks remote and user explicitly requests SSL support
  if (process.env.PGSSLMODE === 'require' || process.env.SUPABASE_DB_SSL === 'true') {
    poolConfig.ssl = { rejectUnauthorized: false };
  }
}
const pool = new Pool(poolConfig);

// Users to seed. Emails/passwords can be provided via Backend/.env for production safety.
const USERS = [
  {
    table: 'admins',
    name: process.env.ADMIN_NAME || 'Administrator',
    email: process.env.ADMIN_EMAIL || 'admin@assa-ac.local',
    password: process.env.ADMIN_PASSWORD || 'Admin@123',
  },
  {
    table: 'operateurs',
    name: process.env.OPERATEUR_NAME || 'Charles Operateur',
    email: process.env.OPERATEUR_EMAIL || 'operateur12@gmail.com',
    password: process.env.OPERATEUR_PASSWORD || 'Operateur@123',
  },
  {
    table: 'superviseurs',
    name: process.env.DAF_NAME || 'DAF Superviseur',
    email: process.env.DAF_EMAIL || 'daf@assa-ac.local',
    password: process.env.DAF_PASSWORD || 'Daf@123',
  }
];

async function userExists(table, email) {
  if (usingSupabase && supabaseClient) {
    // Try to detect the id column (usually 'id') and query by email
    const idCol = 'id';
    try {
      const { data, error } = await supabaseClient.from(table).select(idCol).eq('email', email).limit(1);
      if (error) throw error;
      return Array.isArray(data) && data.length > 0;
    } catch (e) {
      // If table schema differs, surface the error
      throw e;
    }
  }
  const q = `SELECT id FROM ${table} WHERE email = $1 LIMIT 1`;
  const { rows } = await pool.query(q, [email]);
  return rows.length > 0;
}

async function insertUser(table, name, email, passwordHash) {
  if (usingSupabase && supabaseClient) {
    // Heuristically detect name/password column names
    const nameCandidates = ['nom', 'name', 'full_name', 'username'];
    const passCandidates = ['password_hash', 'password', 'passwd'];

    let nameCol = null;
    for (const c of nameCandidates) {
      const { error } = await supabaseClient.from(table).select(c).limit(1);
      if (!error) { nameCol = c; break; }
    }
    let passCol = null;
    for (const c of passCandidates) {
      const { error } = await supabaseClient.from(table).select(c).limit(1);
      if (!error) { passCol = c; break; }
    }

    const payload = { email };
    if (nameCol) payload[nameCol] = name;
    if (passCol) payload[passCol] = passwordHash;

    // Special-case: allow admins to provide a JSON profile via env var ADMIN_PROFILE
    if (table === 'admins' && process.env.ADMIN_PROFILE) {
      try { payload.profile = JSON.parse(process.env.ADMIN_PROFILE); } catch (e) { payload.profile = process.env.ADMIN_PROFILE; }
    }

    // Try insert, if a NOT NULL constraint mentions a missing column, add name into that column and retry (few attempts)
    let res = null;
    const maxRetries = 6;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      res = await supabaseClient.from(table).insert(payload).select('id').limit(1);
      if (!res.error) break;
      const errMsg = String(res.error.message || res.error);
      const m = errMsg.match(/null value in column "([^"]+)"/i);
      if (m && m[1]) {
        const missingCol = m[1];
        // Fill missing column with the provided name (best-effort)
        payload[missingCol] = name;
        continue; // retry
      }
      // Other errors — stop and throw
      break;
    }
    if (res && res.error) throw res.error;
    const data = res && res.data;
    return data && data[0] && data[0].id;
  }
  const q = `INSERT INTO ${table} (nom, email, password_hash, actif, created_at, updated_at) VALUES ($1, $2, $3, true, NOW(), NOW()) RETURNING id`;
  const { rows } = await pool.query(q, [name, email, passwordHash]);
  return rows[0] && rows[0].id;
}

async function seed() {
  console.log('🔐 Seed users script started');
  try {
    let hadErrors = false;
    for (const u of USERS) {
      console.log(`\n➡️ Processing ${u.email} -> table ${u.table}`);

      try {
        const exists = await userExists(u.table, u.email);
        if (exists) {
          console.log(`   ✅ User already exists: ${u.email} — skipping`);
          continue;
        }

        if (!u.password) {
          console.warn(`   ⚠️ No password provided for ${u.email}. Skipping user creation.`);
          continue;
        }

        const hash = await bcrypt.hash(u.password, 10);
        const id = await insertUser(u.table, u.name, u.email, hash);
        if (id) {
          console.log(`   ✅ Created user ${u.email} (id=${id}) in table ${u.table}`);
        } else {
          console.warn(`   ⚠️ Insert reported no id for ${u.email}`);
        }
      } catch (innerErr) {
        hadErrors = true;
        console.error(`   ❌ Error processing ${u.email}:`, innerErr.message || innerErr);
      }
    }
    console.log('\n🎉 Seed users script finished');
    await pool.end();
    if (hadErrors) {
      console.error('❌ Some users failed to be processed. See errors above.');
      process.exit(1);
    }
    console.log('✅ All users processed successfully');
    process.exit(0);
  } catch (err) {
    console.error('❌ Fatal error during seeding:', err.message || err);
    try { await pool.end(); } catch (_) {}
    process.exit(1);
  }
}

// Run the seeding process
seed();

// Helpful note for operators running the script manually:
// - Provide credentials in Backend/.env as ADMIN_PASSWORD, OPERATEUR_PASSWORD, DAF_PASSWORD and optional emails.
// - The script is idempotent: re-running will not create duplicates (checks by email).
