export default async function handler(req, res) {
  try {
    // Test method
    const method = req.method;

    // Test env (ẩn bớt cho an toàn)
    const hasGoogleCreds = !!process.env.GOOGLE_CREDENTIALS;

    // Response
    return res.status(200).json({
      status: 'ok',
      message: 'API is working 🚀',
      method,
      googleCredentials: hasGoogleCreds ? 'FOUND' : 'NOT_FOUND',
      time: new Date().toISOString(),
    });
  } catch (err) {
    return res.status(500).json({
      status: 'error',
      message: err.message,
    });
  }
}