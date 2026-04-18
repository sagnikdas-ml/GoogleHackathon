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
