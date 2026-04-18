import dotenv from 'dotenv';
import crypto from 'node:crypto';
import Busboy from 'busboy';
import express from 'express';
import cors from 'cors';
import { v2 as speech } from '@google-cloud/speech';
import { Storage } from '@google-cloud/storage';
import { onRequest } from 'firebase-functions/v2/https';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { calendarClient, docsClient, driveClient } from './google';
import { generateQuizFromText, summarizeTranscriptToNotes } from './utils';

dotenv.config();

if (!getApps().length) {
  initializeApp();
}

const db = getFirestore();
const app = express();
const storage = new Storage();
const speechClient = new speech.SpeechClient();
const transcriptsCollection = process.env.TRANSCRIPTS_COLLECTION || 'transcriptions';
const defaultLanguageCode = process.env.TRANSCRIPTS_LANGUAGE || 'en-US';
const defaultModel = process.env.TRANSCRIPTS_MODEL || 'short';

app.use(cors({ origin: true }));
app.use(express.json({ limit: '25mb' }));

type UploadedAudio = {
  buffer: Buffer;
  mimetype: string;
  originalName: string;
};

type RawBodyRequest = express.Request & {
  rawBody?: Buffer;
};

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

async function getProjectId() {
  const configuredProjectId =
    process.env.GOOGLE_CLOUD_PROJECT ||
    process.env.GCLOUD_PROJECT ||
    process.env.GCP_PROJECT;

  if (configuredProjectId) {
    return configuredProjectId;
  }

  return speechClient.getProjectId();
}

function getBucketName(projectId: string) {
  return (
    process.env.TRANSCRIPTS_BUCKET ||
    process.env.GCS_BUCKET ||
    (projectId ? `${projectId}.appspot.com` : '')
  );
}

async function uploadAudioIfConfigured(file: UploadedAudio, projectId: string) {
  const bucketName = getBucketName(projectId);

  if (!bucketName) {
    return null;
  }

  const extension = file.mimetype.includes('ogg')
    ? 'ogg'
    : file.mimetype.includes('mp4')
      ? 'mp4'
      : file.mimetype.includes('mpeg')
        ? 'mp3'
        : 'webm';
  const fileName = `recordings/${Date.now()}-${crypto.randomUUID()}.${extension}`;
  const bucket = storage.bucket(bucketName);
  const audioFile = bucket.file(fileName);

  await audioFile.save(file.buffer, {
    resumable: false,
    contentType: file.mimetype,
    metadata: {
      cacheControl: 'private, max-age=0'
    }
  });

  return `gs://${bucketName}/${fileName}`;
}

async function transcribeAudio(params: {
  file: UploadedAudio;
  projectId: string;
  languageCode: string;
  model: string;
}) {
  const recognizer = `projects/${params.projectId}/locations/global/recognizers/_`;
  const [response] = await speechClient.recognize({
    recognizer,
    config: {
      autoDecodingConfig: {},
      languageCodes: [params.languageCode],
      model: params.model,
      features: {
        enableAutomaticPunctuation: true
      }
    },
    content: params.file.buffer
  });

  const transcript = (response.results || [])
    .map((result) => result.alternatives?.[0]?.transcript || '')
    .filter(Boolean)
    .join(' ')
    .trim();

  return transcript;
}

async function parseMultipartAudio(req: RawBodyRequest): Promise<{
  file: UploadedAudio | null;
  fields: Record<string, string>;
}> {
  const contentType = req.headers['content-type'] || '';

  if (!contentType.includes('multipart/form-data')) {
    return { file: null, fields: {} };
  }

  return new Promise((resolve, reject) => {
    const fields: Record<string, string> = {};
    let file: UploadedAudio | null = null;
    const chunks: Buffer[] = [];

    const busboy = Busboy({
      headers: req.headers,
      limits: {
        fileSize: 15 * 1024 * 1024,
        files: 1
      }
    });

    busboy.on('field', (name, value) => {
      fields[name] = value;
    });

    busboy.on('file', (name, stream, info) => {
      if (name !== 'audio') {
        stream.resume();
        return;
      }

      const mimeType = info.mimeType || 'application/octet-stream';
      const originalName = info.filename || 'recording.webm';

      stream.on('data', (chunk: Buffer) => {
        chunks.push(chunk);
      });

      stream.on('limit', () => {
        reject(new Error('Audio file exceeds the 15MB upload limit.'));
      });

      stream.on('end', () => {
        file = {
          buffer: Buffer.concat(chunks),
          mimetype: mimeType,
          originalName
        };
      });
    });

    busboy.on('error', (error) => {
      reject(error);
    });

    busboy.on('finish', () => {
      resolve({ file, fields });
    });

    busboy.end(req.rawBody || Buffer.alloc(0));
  });
}

function parseJsonAudio(req: express.Request): {
  file: UploadedAudio | null;
  fields: Record<string, string>;
} {
  const body = (req.body || {}) as {
    audioBase64?: string;
    mimeType?: string;
    fileName?: string;
    languageCode?: string;
    model?: string;
    durationMs?: string | number;
  };

  if (!body.audioBase64) {
    return { file: null, fields: {} };
  }

  return {
    file: {
      buffer: Buffer.from(body.audioBase64, 'base64'),
      mimetype: body.mimeType || 'audio/webm',
      originalName: body.fileName || 'recording.webm'
    },
    fields: {
      languageCode: body.languageCode || '',
      model: body.model || '',
      durationMs: String(body.durationMs || '')
    }
  };
}

app.get('/', (_req, res) => {
  res.json({ ok: true, service: 'study-buddy-functions' });
});

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function toIsoString(value: unknown): string | null {
  if (!value) {
    return null;
  }

  if (value instanceof Timestamp) {
    return value.toDate().toISOString();
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === 'string') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? value : parsed.toISOString();
  }

  if (typeof value === 'object' && value !== null && 'toDate' in value) {
    const maybeDate = (value as { toDate?: () => Date }).toDate?.();
    return maybeDate ? maybeDate.toISOString() : null;
  }

  return null;
}

function serializeNote(id: string, data: Record<string, unknown>) {
  return {
    id,
    title: typeof data.title === 'string' ? data.title : '',
    content: typeof data.content === 'string' ? data.content : '',
    subject: typeof data.subject === 'string' ? data.subject : '',
    createdAt: toIsoString(data.createdAt),
    updatedAt: toIsoString(data.updatedAt)
  };
}

function serializeTask(id: string, data: Record<string, unknown>) {
  return {
    id,
    title: typeof data.title === 'string' ? data.title : '',
    subject: typeof data.subject === 'string' ? data.subject : '',
    dueDate: typeof data.dueDate === 'string' ? data.dueDate : '',
    status: typeof data.status === 'string' ? data.status : 'todo',
    priority: typeof data.priority === 'string' ? data.priority : 'medium',
    createdAt: toIsoString(data.createdAt),
    updatedAt: toIsoString(data.updatedAt)
  };
}

function serializeEvent(id: string, data: Record<string, unknown>) {
  return {
    id,
    title: typeof data.title === 'string' ? data.title : '',
    subject: typeof data.subject === 'string' ? data.subject : '',
    startTime: typeof data.startTime === 'string' ? data.startTime : '',
    endTime: typeof data.endTime === 'string' ? data.endTime : '',
    sharedWith: Array.isArray(data.sharedWith) ? data.sharedWith : [],
    createdAt: toIsoString(data.createdAt),
    updatedAt: toIsoString(data.updatedAt)
  };
}

app.post('/notes', async (req, res) => {
  try {
    const { title, content, subject } = req.body as {
      title?: string;
      content?: string;
      subject?: string;
    };

    if (!isNonEmptyString(title) || !isNonEmptyString(content)) {
      return res.status(400).json({ error: 'Title and content are required.' });
    }

    const newNote = {
      title: title.trim(),
      content: content.trim(),
      subject: typeof subject === 'string' ? subject.trim() : '',
      createdAt: Timestamp.now()
    };

    const docRef = await db.collection('notes').add(newNote);
    res.status(201).json(serializeNote(docRef.id, newNote));
  } catch (error) {
    console.error('Failed to create note', error);
    res.status(500).json({ error: getErrorMessage(error, 'Failed to create note.') });
  }
});

app.get('/notes', async (_req, res) => {
  try {
    const snapshot = await db.collection('notes').get();
    const items = snapshot.docs
      .map((doc) => serializeNote(doc.id, doc.data()))
      .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));

    res.json(items);
  } catch (error) {
    console.error('Failed to load notes', error);
    res.status(500).json({ error: getErrorMessage(error, 'Failed to load notes.') });
  }
});

app.put('/notes/:id', async (req, res) => {
  try {
    const noteRef = db.collection('notes').doc(req.params.id);
    const snapshot = await noteRef.get();

    if (!snapshot.exists) {
      return res.status(404).json({ error: 'Note not found.' });
    }

    const current = snapshot.data() || {};
    const { title, content, subject } = req.body as {
      title?: string;
      content?: string;
      subject?: string;
    };

    const updatedNote = {
      title: isNonEmptyString(title) ? title.trim() : typeof current.title === 'string' ? current.title : '',
      content: isNonEmptyString(content) ? content.trim() : typeof current.content === 'string' ? current.content : '',
      subject: typeof subject === 'string' ? subject.trim() : typeof current.subject === 'string' ? current.subject : '',
      createdAt: current.createdAt || Timestamp.now(),
      updatedAt: Timestamp.now()
    };

    await noteRef.set(updatedNote);
    res.json(serializeNote(snapshot.id, updatedNote));
  } catch (error) {
    console.error('Failed to update note', error);
    res.status(500).json({ error: getErrorMessage(error, 'Failed to update note.') });
  }
});

app.delete('/notes/:id', async (req, res) => {
  try {
    const noteRef = db.collection('notes').doc(req.params.id);
    const snapshot = await noteRef.get();

    if (!snapshot.exists) {
      return res.status(404).json({ error: 'Note not found.' });
    }

    await noteRef.delete();
    res.json({ message: 'Note deleted successfully.' });
  } catch (error) {
    console.error('Failed to delete note', error);
    res.status(500).json({ error: getErrorMessage(error, 'Failed to delete note.') });
  }
});

app.post('/tasks', async (req, res) => {
  try {
    const { title, subject, dueDate, status, priority } = req.body as {
      title?: string;
      subject?: string;
      dueDate?: string;
      status?: string;
      priority?: string;
    };

    if (!isNonEmptyString(title)) {
      return res.status(400).json({ error: 'Title is required.' });
    }

    const newTask = {
      title: title.trim(),
      subject: typeof subject === 'string' ? subject.trim() : '',
      dueDate: typeof dueDate === 'string' ? dueDate.trim() : '',
      status: typeof status === 'string' && status.trim() ? status.trim() : 'todo',
      priority: typeof priority === 'string' && priority.trim() ? priority.trim() : 'medium',
      createdAt: Timestamp.now()
    };

    const docRef = await db.collection('tasks').add(newTask);
    res.status(201).json(serializeTask(docRef.id, newTask));
  } catch (error) {
    console.error('Failed to create task', error);
    res.status(500).json({ error: getErrorMessage(error, 'Failed to create task.') });
  }
});

app.get('/tasks', async (_req, res) => {
  try {
    const snapshot = await db.collection('tasks').get();
    const items = snapshot.docs
      .map((doc) => serializeTask(doc.id, doc.data()))
      .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));

    res.json(items);
  } catch (error) {
    console.error('Failed to load tasks', error);
    res.status(500).json({ error: getErrorMessage(error, 'Failed to load tasks.') });
  }
});

app.put('/tasks/:id', async (req, res) => {
  try {
    const taskRef = db.collection('tasks').doc(req.params.id);
    const snapshot = await taskRef.get();

    if (!snapshot.exists) {
      return res.status(404).json({ error: 'Task not found.' });
    }

    const current = snapshot.data() || {};
    const { title, subject, dueDate, status, priority } = req.body as {
      title?: string;
      subject?: string;
      dueDate?: string;
      status?: string;
      priority?: string;
    };

    const updatedTask = {
      title: isNonEmptyString(title) ? title.trim() : typeof current.title === 'string' ? current.title : '',
      subject: typeof subject === 'string' ? subject.trim() : typeof current.subject === 'string' ? current.subject : '',
      dueDate: typeof dueDate === 'string' ? dueDate.trim() : typeof current.dueDate === 'string' ? current.dueDate : '',
      status: typeof status === 'string' && status.trim() ? status.trim() : typeof current.status === 'string' ? current.status : 'todo',
      priority:
        typeof priority === 'string' && priority.trim()
          ? priority.trim()
          : typeof current.priority === 'string'
            ? current.priority
            : 'medium',
      createdAt: current.createdAt || Timestamp.now(),
      updatedAt: Timestamp.now()
    };

    await taskRef.set(updatedTask);
    res.json(serializeTask(snapshot.id, updatedTask));
  } catch (error) {
    console.error('Failed to update task', error);
    res.status(500).json({ error: getErrorMessage(error, 'Failed to update task.') });
  }
});

app.delete('/tasks/:id', async (req, res) => {
  try {
    const taskRef = db.collection('tasks').doc(req.params.id);
    const snapshot = await taskRef.get();

    if (!snapshot.exists) {
      return res.status(404).json({ error: 'Task not found.' });
    }

    await taskRef.delete();
    res.json({ message: 'Task deleted successfully.' });
  } catch (error) {
    console.error('Failed to delete task', error);
    res.status(500).json({ error: getErrorMessage(error, 'Failed to delete task.') });
  }
});

app.post('/events', async (req, res) => {
  try {
    const { title, subject, startTime, endTime } = req.body as {
      title?: string;
      subject?: string;
      startTime?: string;
      endTime?: string;
    };

    if (!isNonEmptyString(title) || !isNonEmptyString(startTime)) {
      return res.status(400).json({ error: 'Title and start time are required.' });
    }

    const newEvent = {
      title: title.trim(),
      subject: typeof subject === 'string' ? subject.trim() : '',
      startTime: startTime.trim(),
      endTime: typeof endTime === 'string' ? endTime.trim() : '',
      createdAt: Timestamp.now()
    };

    const docRef = await db.collection('events').add(newEvent);
    res.status(201).json(serializeEvent(docRef.id, newEvent));
  } catch (error) {
    console.error('Failed to create event', error);
    res.status(500).json({ error: getErrorMessage(error, 'Failed to create event.') });
  }
});

app.get('/events', async (_req, res) => {
  try {
    const snapshot = await db.collection('events').get();
    const items = snapshot.docs
      .map((doc) => serializeEvent(doc.id, doc.data()))
      .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));

    res.json(items);
  } catch (error) {
    console.error('Failed to load events', error);
    res.status(500).json({ error: getErrorMessage(error, 'Failed to load events.') });
  }
});

app.put('/events/:id', async (req, res) => {
  try {
    const eventRef = db.collection('events').doc(req.params.id);
    const snapshot = await eventRef.get();

    if (!snapshot.exists) {
      return res.status(404).json({ error: 'Event not found.' });
    }

    const current = snapshot.data() || {};
    const { title, subject, startTime, endTime } = req.body as {
      title?: string;
      subject?: string;
      startTime?: string;
      endTime?: string;
    };

    const updatedEvent = {
      ...current,
      title: isNonEmptyString(title) ? title.trim() : typeof current.title === 'string' ? current.title : '',
      subject: typeof subject === 'string' ? subject.trim() : typeof current.subject === 'string' ? current.subject : '',
      startTime:
        isNonEmptyString(startTime)
          ? startTime.trim()
          : typeof current.startTime === 'string'
            ? current.startTime
            : '',
      endTime: typeof endTime === 'string' ? endTime.trim() : typeof current.endTime === 'string' ? current.endTime : '',
      createdAt: current.createdAt || Timestamp.now(),
      updatedAt: Timestamp.now()
    };

    await eventRef.set(updatedEvent);
    res.json(serializeEvent(snapshot.id, updatedEvent));
  } catch (error) {
    console.error('Failed to update event', error);
    res.status(500).json({ error: getErrorMessage(error, 'Failed to update event.') });
  }
});

app.delete('/events/:id', async (req, res) => {
  try {
    const eventRef = db.collection('events').doc(req.params.id);
    const snapshot = await eventRef.get();

    if (!snapshot.exists) {
      return res.status(404).json({ error: 'Event not found.' });
    }

    await eventRef.delete();
    res.json({ message: 'Event deleted successfully.' });
  } catch (error) {
    console.error('Failed to delete event', error);
    res.status(500).json({ error: getErrorMessage(error, 'Failed to delete event.') });
  }
});

app.get('/progress', async (_req, res) => {
  try {
    const [notesSnap, tasksSnap, eventsSnap] = await Promise.all([
      db.collection('notes').get(),
      db.collection('tasks').get(),
      db.collection('events').get()
    ]);

    const totalNotes = notesSnap.size;
    const totalTasks = tasksSnap.size;
    const totalEvents = eventsSnap.size;
    const completedTasks = tasksSnap.docs.filter((doc) => doc.data().status === 'done').length;
    const pendingTasks = totalTasks - completedTasks;
    const completionRate = totalTasks ? Math.round((completedTasks / totalTasks) * 100) : 0;

    res.json({
      totalNotes,
      totalTasks,
      completedTasks,
      pendingTasks,
      totalEvents,
      completionRate
    });
  } catch (error) {
    console.error('Failed to load dashboard progress', error);
    res.status(500).json({ error: getErrorMessage(error, 'Failed to load dashboard progress.') });
  }
});

app.post('/summarize', async (req, res) => {
  const { text = '' } = req.body as { text?: string };

  if (!isNonEmptyString(text)) {
    return res.status(400).json({ error: 'Text is required.' });
  }

  res.json({
    summary: summarizeTranscriptToNotes(text)
  });
});

app.post('/quiz', async (req, res) => {
  const { text = '' } = req.body as { text?: string };

  if (!isNonEmptyString(text)) {
    return res.status(400).json({ error: 'Text is required.' });
  }

  res.json({
    questions: generateQuizFromText(text)
  });
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

app.get('/transcriptions', async (_req, res) => {
  try {
    const snapshot = await db
      .collection(transcriptsCollection)
      .orderBy('createdAt', 'desc')
      .limit(20)
      .get();

    const items = snapshot.docs.map((doc) => {
      const data = doc.data();

      return {
        id: doc.id,
        transcript: typeof data.transcript === 'string' ? data.transcript : '',
        audioUri: typeof data.audioUri === 'string' ? data.audioUri : null,
        mimeType: typeof data.mimeType === 'string' ? data.mimeType : null,
        languageCode: typeof data.languageCode === 'string' ? data.languageCode : defaultLanguageCode,
        model: typeof data.model === 'string' ? data.model : defaultModel,
        durationMs: typeof data.durationMs === 'number' ? data.durationMs : null,
        createdAt: data.createdAt?.toDate?.()?.toISOString() || null
      };
    });

    res.json({ items });
  } catch (error) {
    console.error('Failed to load transcriptions', error);
    res.status(500).json({ error: 'Failed to load transcription history.' });
  }
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

app.post('/transcribeAudio', async (req, res) => {
  try {
    const multipart = await parseMultipartAudio(req as RawBodyRequest);
    const jsonUpload = multipart.file ? multipart : parseJsonAudio(req);
    const file = jsonUpload.file;
    const languageCode = String(jsonUpload.fields.languageCode || defaultLanguageCode).trim() || defaultLanguageCode;
    const model = String(jsonUpload.fields.model || defaultModel).trim() || defaultModel;
    const durationMs = Number(jsonUpload.fields.durationMs || 0) || null;

    if (!file) {
      return res.status(400).json({ error: 'No audio file was uploaded.' });
    }

    const projectId = await getProjectId();

    if (!projectId) {
      return res.status(500).json({
        error: 'Google Cloud project ID is not configured for this service.'
      });
    }

    const [audioUri, transcript] = await Promise.all([
      uploadAudioIfConfigured(file, projectId).catch((error) => {
        console.error('Audio upload skipped after Cloud Storage failure', error);
        return null;
      }),
      transcribeAudio({
        file,
        projectId,
        languageCode,
        model
      })
    ]);

    if (!transcript) {
      return res.status(422).json({
        error: 'Speech-to-Text did not return any transcript. Try again with a shorter or clearer recording.'
      });
    }

    const docRef = await db.collection(transcriptsCollection).add({
      transcript,
      audioUri,
      mimeType: file.mimetype,
      languageCode,
      model,
      durationMs,
      createdAt: Timestamp.now()
    });

    res.json({
      item: {
        id: docRef.id,
        transcript,
        audioUri,
        mimeType: file.mimetype,
        languageCode,
        model,
        durationMs,
        createdAt: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Failed to create transcription', error);
    res.status(500).json({
      error: getErrorMessage(error, 'Failed to transcribe audio.')
    });
  }
});

export const api = onRequest({ region: 'europe-west3' }, app);
