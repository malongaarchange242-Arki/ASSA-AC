import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import supabase from '../Config/db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

async function check(email) {
  console.log('Checking email in Supabase:', email);
  for (const table of ['admins', 'companies', 'operateurs', 'superviseurs']) {
    try {
      const { data, error } = await supabase.from(table).select('*').ilike('email', email).limit(10);
      if (error) console.error(table, 'error:', error.message || error);
      else console.log(table, 'rows:', data && data.length);
    } catch (e) {
      console.error('Exception checking', table, e.message || e);
    }
  }
}

const email = process.argv[2] || 'operateur12@gmail.com';
check(email).then(() => process.exit(0)).catch(() => process.exit(1));
