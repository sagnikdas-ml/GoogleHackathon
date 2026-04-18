import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import { onRequest } from 'firebase-functions/v2/https';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { calendarClient, docsClient, driveClient } from './google';
import { generateQuizFromText, summarizeTranscriptToNotes } from './utils';

dotenv.config();

if (!getApps().length) {
  initializeApp();
}

const db = getFirestore();
const app = express();
app.use(cors({ origin: true }));
app.use(express.json({ limit: '10mb' }));

app.get('/', (_req, res) => {
  res.json({ ok: true, service: 'study-buddy-functions' });
});

app.post('/generateQuiz', async (req, res) => {
  const { sourceText = '' } = req.body as { sourceText?: string };
  const questions = generateQuizFromText(sourceText);
  res.json({ questions });
});

app.post('/summarizeTranscript', async (req, res) => {
  const { transcript = '' } = req.body as { transcript?: string };
  const notes = summarizeTranscriptToNotes(transcript);
  res.json({ notes });
});

app.post('/createCalendarEvent', async (req, res) => {
  try {
    const { title, attendeeEmails, startTime, endTime, description } = req.body as {
      title: string;
      attendeeEmails: string[];
      startTime: string;
      endTime: string;
      description?: string;
    };

    const calendar = calendarClient();
    const calendarId = process.env.GOOGLE_CALENDAR_ID || 'primary';
    const response = await calendar.events.insert({
      calendarId,
      requestBody: {
        summary: title,
        description,
        start: { dateTime: startTime },
        end: { dateTime: endTime },
        attendees: (attendeeEmails || []).map((email) => ({ email }))
      },
      sendUpdates: 'all'
    });

    const eventData = {
      title,
      startTime,
      endTime,
      sharedWith: attendeeEmails || [],
      calendarEventId: response.data.id,
      createdAt: new Date().toISOString()
    };

    await db.collection('events').add(eventData);

    res.json({
      id: response.data.id,
      htmlLink: response.data.htmlLink,
      event: eventData
    });
  } catch (error) {
    console.error(error);
    res.status(500).send('Failed to create Calendar event');
  }
});

app.post('/exportNotesToDoc', async (req, res) => {
  try {
    const { title, content, shareWith = [] } = req.body as {
      title: string;
      content: string;
      shareWith?: string[];
    };

    const docs = docsClient();
    const drive = driveClient();
    const created = await docs.documents.create({ requestBody: { title } });
    const documentId = created.data.documentId;

    if (!documentId) {
      throw new Error('No documentId returned');
    }

    await docs.documents.batchUpdate({
      documentId,
      requestBody: {
        requests: [
          {
            insertText: {
              location: { index: 1 },
              text: `${title}\n\n${content}`
            }
          }
        ]
      }
    });

    for (const email of shareWith) {
      await drive.permissions.create({
        fileId: documentId,
        requestBody: {
          type: 'user',
          role: 'writer',
          emailAddress: email
        },
        sendNotificationEmail: false
      });
    }

    res.json({
      documentId,
      documentUrl: `https://docs.google.com/document/d/${documentId}/edit`
    });
  } catch (error) {
    console.error(error);
    res.status(500).send('Failed to export notes to Google Docs');
  }
});

app.post('/transcribeAudio', async (_req, res) => {
  res.json({
    transcript: 'Stub transcript response. Replace this with Cloud Speech-to-Text integration.',
    mode: 'hackathon-stub'
  });
});

export const api = onRequest({ region: 'europe-west3' }, app);
