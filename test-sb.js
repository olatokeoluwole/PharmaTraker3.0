import { createClient } from '@supabase/supabase-js';
const supabase = createClient('https://wmcmzrnqhgopxyvkytrn.supabase.co', 'sb_publishable_5q-Om1BrJ5GLTSI6soaNjQ_Vcqix1Nj');
supabase.auth.signInWithPassword({ email: "test", password: "test" }).then(res => console.log(res));
