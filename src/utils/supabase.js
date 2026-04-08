// src/utils/supabase.js
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    console.log('Supabase URL:', process.env.SUPABASE_URL);
    console.log('Supabase Anon Key:', process.env.SUPABASE_ANON_KEY);
  throw new Error('Supabase environment variables are missing!');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);