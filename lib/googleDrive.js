import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';

export function getDrive() {
  const credentials = JSON.parse(
    fs.readFileSync(path.join(process.cwd(), 'google-credentials.json'), 'utf8')
  );

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/drive']
  });

  return google.drive({ version: 'v3', auth });
}