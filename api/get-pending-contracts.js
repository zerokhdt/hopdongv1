import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*'); // hoặc 'http://localhost:5173'
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Lấy biến môi trường
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY;

  console.log('SUPABASE_URL:', supabaseUrl);
  console.log('SUPABASE_ANON_KEY:', supabaseKey ? 'exists' : 'missing');

  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: 'Supabase environment variables are missing!' });
  }

  // Tạo client Supabase
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const { data, error } = await supabase
      .from('contract_logs')
      .select('*')
      .lt('workflow_stage', 3)
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.status(200).json({ contracts: data });
  } catch (err) {
    console.error('Supabase query error:', err.message || err);
    res.status(500).json({ error: err.message || 'Unknown error' });
  }
}