import { getOAuthClient } from '../../lib/googleOAuth';

export default function handler(req, res) {
  const oauth2Client = getOAuthClient();

  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: ['https://www.googleapis.com/auth/drive.file']
  });

  res.json({ url });
}