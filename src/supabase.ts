import { createClient } from '@supabase/supabase-js';

const getEnv = (key: string) => {
  if (typeof process !== 'undefined' && process.env && process.env[key]) {
    return process.env[key];
  }
  if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[key]) {
    return import.meta.env[key];
  }
  return undefined;
};

const supabaseUrlRaw = getEnv('VITE_SUPABASE_URL') || 'https://wmcmzrnqhgopxyvkytrn.supabase.co';
const supabaseUrl = supabaseUrlRaw.replace(/\/rest\/v1\/?$/, '');
const supabaseAnonKey = getEnv('VITE_SUPABASE_ANON_KEY') || 'sb_publishable_5q-Om1BrJ5GLTSI6soaNjQ_Vcqix1Nj';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
