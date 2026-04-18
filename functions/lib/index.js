"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.api = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
const node_crypto_1 = __importDefault(require("node:crypto"));
const busboy_1 = __importDefault(require("busboy"));
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const speech_1 = require("@google-cloud/speech");
const storage_1 = require("@google-cloud/storage");
const https_1 = require("firebase-functions/v2/https");
const app_1 = require("firebase-admin/app");
const firestore_1 = require("firebase-admin/firestore");
const google_1 = require("./google");
const utils_1 = require("./utils");
dotenv_1.default.config();
if (!(0, app_1.getApps)().length) {
    (0, app_1.initializeApp)();
}
const db = (0, firestore_1.getFirestore)();
const app = (0, express_1.default)();
const storage = new storage_1.Storage();
const speechClient = new speech_1.v2.SpeechClient();
const transcriptsCollection = process.env.TRANSCRIPTS_COLLECTION || 'transcriptions';
const defaultLanguageCode = process.env.TRANSCRIPTS_LANGUAGE || 'en-US';
const defaultModel = process.env.TRANSCRIPTS_MODEL || 'short';
app.use((0, cors_1.default)({ origin: true }));
app.use(express_1.default.json({ limit: '25mb' }));
function getErrorMessage(error, fallback) {
    return error instanceof Error ? error.message : fallback;
}
async function getProjectId() {
    const configuredProjectId = process.env.GOOGLE_CLOUD_PROJECT ||
        process.env.GCLOUD_PROJECT ||
        process.env.GCP_PROJECT;
    if (configuredProjectId) {
        return configuredProjectId;
    }
    return speechClient.getProjectId();
}
function getBucketName(projectId) {
    return (process.env.TRANSCRIPTS_BUCKET ||
        process.env.GCS_BUCKET ||
        (projectId ? `${projectId}.appspot.com` : ''));
}
async function uploadAudioIfConfigured(file, projectId) {
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
    const fileName = `recordings/${Date.now()}-${node_crypto_1.default.randomUUID()}.${extension}`;
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
async function transcribeAudio(params) {
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
async function parseMultipartAudio(req) {
    const contentType = req.headers['content-type'] || '';
    if (!contentType.includes('multipart/form-data')) {
        return { file: null, fields: {} };
    }
    return new Promise((resolve, reject) => {
        const fields = {};
        let file = null;
        const chunks = [];
        const busboy = (0, busboy_1.default)({
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
            stream.on('data', (chunk) => {
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
function parseJsonAudio(req) {
    const body = (req.body || {});
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
function isNonEmptyString(value) {
    return typeof value === 'string' && value.trim().length > 0;
}
function toIsoString(value) {
    if (!value) {
        return null;
    }
    if (value instanceof firestore_1.Timestamp) {
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
        const maybeDate = value.toDate?.();
        return maybeDate ? maybeDate.toISOString() : null;
    }
    return null;
}
function serializeNote(id, data) {
    return {
        id,
        title: typeof data.title === 'string' ? data.title : '',
        content: typeof data.content === 'string' ? data.content : '',
        subject: typeof data.subject === 'string' ? data.subject : '',
        createdAt: toIsoString(data.createdAt),
        updatedAt: toIsoString(data.updatedAt)
    };
}
function serializeTask(id, data) {
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
function serializeEvent(id, data) {
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
        const { title, content, subject } = req.body;
        if (!isNonEmptyString(title) || !isNonEmptyString(content)) {
            return res.status(400).json({ error: 'Title and content are required.' });
        }
        const newNote = {
            title: title.trim(),
            content: content.trim(),
            subject: typeof subject === 'string' ? subject.trim() : '',
            createdAt: firestore_1.Timestamp.now()
        };
        const docRef = await db.collection('notes').add(newNote);
        res.status(201).json(serializeNote(docRef.id, newNote));
    }
    catch (error) {
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
    }
    catch (error) {
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
        const { title, content, subject } = req.body;
        const updatedNote = {
            title: isNonEmptyString(title) ? title.trim() : typeof current.title === 'string' ? current.title : '',
            content: isNonEmptyString(content) ? content.trim() : typeof current.content === 'string' ? current.content : '',
            subject: typeof subject === 'string' ? subject.trim() : typeof current.subject === 'string' ? current.subject : '',
            createdAt: current.createdAt || firestore_1.Timestamp.now(),
            updatedAt: firestore_1.Timestamp.now()
        };
        await noteRef.set(updatedNote);
        res.json(serializeNote(snapshot.id, updatedNote));
    }
    catch (error) {
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
    }
    catch (error) {
        console.error('Failed to delete note', error);
        res.status(500).json({ error: getErrorMessage(error, 'Failed to delete note.') });
    }
});
app.post('/tasks', async (req, res) => {
    try {
        const { title, subject, dueDate, status, priority } = req.body;
        if (!isNonEmptyString(title)) {
            return res.status(400).json({ error: 'Title is required.' });
        }
        const newTask = {
            title: title.trim(),
            subject: typeof subject === 'string' ? subject.trim() : '',
            dueDate: typeof dueDate === 'string' ? dueDate.trim() : '',
            status: typeof status === 'string' && status.trim() ? status.trim() : 'todo',
            priority: typeof priority === 'string' && priority.trim() ? priority.trim() : 'medium',
            createdAt: firestore_1.Timestamp.now()
        };
        const docRef = await db.collection('tasks').add(newTask);
        res.status(201).json(serializeTask(docRef.id, newTask));
    }
    catch (error) {
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
    }
    catch (error) {
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
        const { title, subject, dueDate, status, priority } = req.body;
        const updatedTask = {
            title: isNonEmptyString(title) ? title.trim() : typeof current.title === 'string' ? current.title : '',
            subject: typeof subject === 'string' ? subject.trim() : typeof current.subject === 'string' ? current.subject : '',
            dueDate: typeof dueDate === 'string' ? dueDate.trim() : typeof current.dueDate === 'string' ? current.dueDate : '',
            status: typeof status === 'string' && status.trim() ? status.trim() : typeof current.status === 'string' ? current.status : 'todo',
            priority: typeof priority === 'string' && priority.trim()
                ? priority.trim()
                : typeof current.priority === 'string'
                    ? current.priority
                    : 'medium',
            createdAt: current.createdAt || firestore_1.Timestamp.now(),
            updatedAt: firestore_1.Timestamp.now()
        };
        await taskRef.set(updatedTask);
        res.json(serializeTask(snapshot.id, updatedTask));
    }
    catch (error) {
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
    }
    catch (error) {
        console.error('Failed to delete task', error);
        res.status(500).json({ error: getErrorMessage(error, 'Failed to delete task.') });
    }
});
app.post('/events', async (req, res) => {
    try {
        const { title, subject, startTime, endTime } = req.body;
        if (!isNonEmptyString(title) || !isNonEmptyString(startTime)) {
            return res.status(400).json({ error: 'Title and start time are required.' });
        }
        const newEvent = {
            title: title.trim(),
            subject: typeof subject === 'string' ? subject.trim() : '',
            startTime: startTime.trim(),
            endTime: typeof endTime === 'string' ? endTime.trim() : '',
            createdAt: firestore_1.Timestamp.now()
        };
        const docRef = await db.collection('events').add(newEvent);
        res.status(201).json(serializeEvent(docRef.id, newEvent));
    }
    catch (error) {
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
    }
    catch (error) {
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
        const { title, subject, startTime, endTime } = req.body;
        const updatedEvent = {
            ...current,
            title: isNonEmptyString(title) ? title.trim() : typeof current.title === 'string' ? current.title : '',
            subject: typeof subject === 'string' ? subject.trim() : typeof current.subject === 'string' ? current.subject : '',
            startTime: isNonEmptyString(startTime)
                ? startTime.trim()
                : typeof current.startTime === 'string'
                    ? current.startTime
                    : '',
            endTime: typeof endTime === 'string' ? endTime.trim() : typeof current.endTime === 'string' ? current.endTime : '',
            createdAt: current.createdAt || firestore_1.Timestamp.now(),
            updatedAt: firestore_1.Timestamp.now()
        };
        await eventRef.set(updatedEvent);
        res.json(serializeEvent(snapshot.id, updatedEvent));
    }
    catch (error) {
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
    }
    catch (error) {
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
    }
    catch (error) {
        console.error('Failed to load dashboard progress', error);
        res.status(500).json({ error: getErrorMessage(error, 'Failed to load dashboard progress.') });
    }
});
app.post('/summarize', async (req, res) => {
    const { text = '' } = req.body;
    if (!isNonEmptyString(text)) {
        return res.status(400).json({ error: 'Text is required.' });
    }
    res.json({
        summary: (0, utils_1.summarizeTranscriptToNotes)(text)
    });
});
app.post('/quiz', async (req, res) => {
    const { text = '' } = req.body;
    if (!isNonEmptyString(text)) {
        return res.status(400).json({ error: 'Text is required.' });
    }
    res.json({
        questions: (0, utils_1.generateQuizFromText)(text)
    });
});
app.post('/generateQuiz', async (req, res) => {
    const { sourceText = '' } = req.body;
    const questions = (0, utils_1.generateQuizFromText)(sourceText);
    res.json({ questions });
});
app.post('/summarizeTranscript', async (req, res) => {
    const { transcript = '' } = req.body;
    const notes = (0, utils_1.summarizeTranscriptToNotes)(transcript);
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
    }
    catch (error) {
        console.error('Failed to load transcriptions', error);
        res.status(500).json({ error: 'Failed to load transcription history.' });
    }
});
app.post('/createCalendarEvent', async (req, res) => {
    try {
        const { title, attendeeEmails, startTime, endTime, description } = req.body;
        const calendar = (0, google_1.calendarClient)();
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
    }
    catch (error) {
        console.error(error);
        res.status(500).send('Failed to create Calendar event');
    }
});
app.post('/exportNotesToDoc', async (req, res) => {
    try {
        const { title, content, shareWith = [] } = req.body;
        const docs = (0, google_1.docsClient)();
        const drive = (0, google_1.driveClient)();
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
    }
    catch (error) {
        console.error(error);
        res.status(500).send('Failed to export notes to Google Docs');
    }
});
app.post('/transcribeAudio', async (req, res) => {
    try {
        const multipart = await parseMultipartAudio(req);
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
            createdAt: firestore_1.Timestamp.now()
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
    }
    catch (error) {
        console.error('Failed to create transcription', error);
        res.status(500).json({
            error: getErrorMessage(error, 'Failed to transcribe audio.')
        });
    }
});
exports.api = (0, https_1.onRequest)({ region: 'europe-west3' }, app);
