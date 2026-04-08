export default async function handler(req, res) {
  const { username, password } = req.body || {};
  if (username === 'moon' && password === '123456') {
    return res.status(200).json({
      success: true,
      token: 'fake-jwt-token-' + Date.now(),
      branch: 'HQ',
      role: 'admin'
    });
  }
  
  if (username === 'chinhanh1' && password === '123456') {
    return res.status(200).json({
      success: true,
      token: 'fake-jwt-token-branch-' + Date.now(),
      branch: 'TRUNG MỸ TÂY',
      role: 'user'
    });
  }
  return res.status(401).json({
    success: false,
    message: 'Sai tài khoản hoặc mật khẩu (Local Mock)'
  });
}
