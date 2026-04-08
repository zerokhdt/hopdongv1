// api/test.js
export default async function handler(req, res) {
  // --- CORS ---
  const allowedOrigin = "http://localhost:5173"; // dev frontend
  res.setHeader("Access-Control-Allow-Origin", allowedOrigin);
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  // --- Preflight request (OPTIONS) ---
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  try {
    // --- Main logic ---
    const data = {
      message: "Serverless Function is working!",
      timestamp: new Date().toISOString()
    };
    res.status(200).json(data);
  } catch (err) {
    // --- Ensure header always sent ---
    res.setHeader("Access-Control-Allow-Origin", allowedOrigin);
    res.status(500).json({ error: err.message });
  }
}