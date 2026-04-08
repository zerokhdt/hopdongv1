import { supabase } from '../src/utils/supabase.js';

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*'); // hoặc 'http://localhost:5173'
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const { data, error } = await supabase
      .from('contract_logs')
      .select('*')
      .lt('workflow_stage', 3)
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.status(200).json({ contracts: data });
  } catch (err) {
    
  }
}