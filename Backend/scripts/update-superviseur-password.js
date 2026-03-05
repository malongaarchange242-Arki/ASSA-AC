import path from 'path';
import dotenv from 'dotenv';
import bcrypt from 'bcrypt';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

// __dirname for ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from Backend/.env
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

async function updateSuperviseurPassword(superviseurId, newPassword) {
  try {
    // Hash the new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    console.log(`🔐 Password hashed successfully`);
    
    // Update the superviseur in Supabase
    const { data, error } = await supabase
      .from('superviseurs')
      .update({
        password_hash: hashedPassword,
        updated_at: new Date().toISOString()
      })
      .eq('id', superviseurId)
      .select('id, email, nom_complet, updated_at');
    
    if (error) {
      console.error('❌ Supabase error:', error.message);
      return false;
    }
    
    if (!data || data.length === 0) {
      console.error('❌ Superviseur not found with ID:', superviseurId);
      return false;
    }
    
    const updated = data[0];
    console.log('✅ Superviseur password updated successfully:');
    console.log(`   ID: ${updated.id}`);
    console.log(`   Email: ${updated.email}`);
    console.log(`   Nom: ${updated.nom_complet}`);
    console.log(`   Updated at: ${updated.updated_at}`);
    
    return true;
  } catch (err) {
    console.error('❌ Error updating password:', err.message);
    return false;
  }
}

async function main() {
  const superviseurId = process.argv[2];
  const newPassword = process.argv[3] || '12345678';
  
  if (!superviseurId) {
    console.error('❌ Usage: node update-superviseur-password.js <superviseur_id> [new_password]');
    console.error('   Example: node update-superviseur-password.js ea2554b9-9a57-4015-b6d1-6b237e188c57 12345678');
    process.exit(1);
  }
  
  console.log(`🔄 Updating password for superviseur: ${superviseurId}`);
  console.log(`📝 New password: ${newPassword}`);
  
  const success = await updateSuperviseurPassword(superviseurId, newPassword);
  
  if (success) {
    console.log('\n✨ Password update completed successfully!');
    process.exit(0);
  } else {
    console.log('\n❌ Password update failed!');
    process.exit(1);
  }
}

main();
