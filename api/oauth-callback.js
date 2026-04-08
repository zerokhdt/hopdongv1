import { getOAuthClient } from '../../lib/googleOAuth';

export default async function handler(req, res) {
  const { code } = req.query;

  const oauth2Client = getOAuthClient();

  const { tokens } = await oauth2Client.getToken(code);

  // 👉 redirect về FE + truyền token
  const redirectUrl = `http://localhost:3000/?access_token=${tokens.access_token}`;

  res.redirect(redirectUrl);
}