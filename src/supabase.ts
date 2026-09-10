import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://wmcmzrnqhgopxyvkytrn.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_5q-Om1BrJ5GLTSI6soaNjQ_Vcqix1Nj';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
