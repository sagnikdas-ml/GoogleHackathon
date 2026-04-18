import dotenv from 'dotenv';
import { google } from 'googleapis';

dotenv.config();

const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');

if (!clientEmail || !privateKey) {
  console.warn('Google service account env vars missing. API calls will fail until configured.');
}

function getAuth(scopes: string[]) {
  return new google.auth.JWT({
    email: clientEmail,
    key: privateKey,
    scopes,
    subject: process.env.GOOGLE_IMPERSONATED_USER || undefined
  });
}

export function calendarClient() {
  return google.calendar({ version: 'v3', auth: getAuth(['https://www.googleapis.com/auth/calendar']) });
}

export function docsClient() {
  return google.docs({ version: 'v1', auth: getAuth([
    'https://www.googleapis.com/auth/documents',
    'https://www.googleapis.com/auth/drive'
  ]) });
}

export function driveClient() {
  return google.drive({ version: 'v3', auth: getAuth(['https://www.googleapis.com/auth/drive']) });
}
