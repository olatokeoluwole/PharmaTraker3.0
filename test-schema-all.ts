import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
async function run() {
  const tables = ['users', 'staff_roles', 'drugs', 'dispense_records', 'prescriptions', 'purchases', 'operating_expenses', 'audits', 'branches'];
  for (const t of tables) {
    const { data, error } = await supabase.from(t).select('*').limit(1);
    console.log(t, error ? error.message : 'OK - columns: ' + (data[0] ? Object.keys(data[0]).join(', ') : 'Empty'));
  }
}
run();
