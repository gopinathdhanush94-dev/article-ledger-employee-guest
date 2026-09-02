import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  console.warn(
    'Supabase env vars are missing. Copy .env.example to .env (locally) ' +
    'or set VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY in your Vercel project settings.'
  );
}

export const supabase = createClient(url, anonKey);
