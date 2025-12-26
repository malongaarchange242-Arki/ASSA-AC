// Backend/config/db.js
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// ES Modules dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env
dotenv.config({ path: path.join(__dirname, '../.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('❌ Supabase URL ou SERVICE_KEY manquante dans le fichier .env');
}

// Create Supabase client
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Optional: test minimal
export const testSupabaseConnection = async () => {
  try {
    const { data, error } = await supabase.from('admins').select('id').limit(1);

    if (error) {
      console.error('❌ Erreur de connexion à Supabase :', error);
    } else {
      console.log('✅ Supabase connecté (table admins accessible)');
    }
  } catch (err) {
    console.error('❌ Impossible de tester Supabase :', err);
  }
};

export default supabase;
