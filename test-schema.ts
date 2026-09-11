import { supabase } from './src/supabase';
async function run() {
  const { data, error } = await supabase.from('users').select('created_at').limit(1);
  console.log(data);
}
run();
