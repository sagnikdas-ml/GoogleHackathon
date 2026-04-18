const path = require("path");
const crypto = require("crypto");
const express = require("express");
const multer = require("multer");
const { Firestore, Timestamp } = require("@google-cloud/firestore");
const { Storage } = require("@google-cloud/storage");
const speech = require("@google-cloud/speech").v2;

const app = express();
const port = Number(process.env.PORT || 8080);
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 15 * 1024 * 1024
  }
});

const firestore = new Firestore();
const storage = new Storage();
const speechClient = new speech.SpeechClient();

const transcriptsCollection =
  process.env.TRANSCRIPTS_COLLECTION || "transcriptions";
const defaultLanguageCode = process.env.TRANSCRIPTS_LANGUAGE || "en-US";
const defaultModel = process.env.TRANSCRIPTS_MODEL || "short";

app.set("trust proxy", true);
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

function getProjectId() {
  return (
    process.env.GOOGLE_CLOUD_PROJECT ||
    process.env.GCLOUD_PROJECT ||
    process.env.GCP_PROJECT ||
    ""
  );
}

function getBucketName(projectId) {
  return (
    process.env.TRANSCRIPTS_BUCKET ||
    process.env.GCS_BUCKET ||
    (projectId ? `${projectId}.appspot.com` : "")
  );
}

async function uploadAudioIfConfigured({ file, projectId }) {
  const bucketName = getBucketName(projectId);

  if (!bucketName) {
    return null;
  }

  const extension = file.mimetype.includes("ogg")
    ? "ogg"
    : file.mimetype.includes("mp4")
      ? "mp4"
      : "webm";
  const fileName = `recordings/${Date.now()}-${crypto.randomUUID()}.${extension}`;
  const bucket = storage.bucket(bucketName);
  const cloudFile = bucket.file(fileName);

  await cloudFile.save(file.buffer, {
    resumable: false,
    contentType: file.mimetype,
    metadata: {
      cacheControl: "private, max-age=0"
    }
  });

  return `gs://${bucketName}/${fileName}`;
}

async function transcribeAudio({ projectId, file, languageCode, model }) {
  const recognizer = `projects/${projectId}/locations/global/recognizers/_`;
  const [response] = await speechClient.recognize({
    recognizer,
    config: {
      autoDecodingConfig: {},
      languageCodes: [languageCode],
      model,
      features: {
        enableAutomaticPunctuation: true
      }
    },
    content: file.buffer
  });

  const transcript = (response.results || [])
    .map((result) => result.alternatives?.[0]?.transcript || "")
    .filter(Boolean)
    .join(" ")
    .trim();

  return {
    transcript,
    rawResponse: response
  };
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.get("/api/transcriptions", async (_req, res) => {
  try {
    const snapshot = await firestore
      .collection(transcriptsCollection)
      .orderBy("createdAt", "desc")
      .limit(20)
      .get();

    const items = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        transcript: data.transcript || "",
        audioUri: data.audioUri || null,
        mimeType: data.mimeType || null,
        languageCode: data.languageCode || defaultLanguageCode,
        durationMs: data.durationMs || null,
        createdAt: data.createdAt?.toDate?.()?.toISOString() || null
      };
    });

    res.json({ items });
  } catch (error) {
    console.error("Failed to load transcriptions", error);
    res.status(500).json({ error: "Failed to load transcriptions." });
  }
});

app.post(
  "/api/transcriptions",
  upload.single("audio"),
  async (req, res) => {
    const projectId = getProjectId();
    const file = req.file;
    const languageCode =
      (req.body.languageCode || defaultLanguageCode).trim() || defaultLanguageCode;
    const model = (req.body.model || defaultModel).trim() || defaultModel;
    const durationMs = Number(req.body.durationMs || 0) || null;

    if (!projectId) {
      return res.status(500).json({
        error:
          "GOOGLE_CLOUD_PROJECT is not set. Deploy on App Engine or configure the project environment."
      });
    }

    if (!file) {
      return res.status(400).json({ error: "No audio file was uploaded." });
    }

    try {
      const [audioUri, transcription] = await Promise.all([
        uploadAudioIfConfigured({ file, projectId }).catch((error) => {
          console.error("Audio upload skipped after Cloud Storage failure", error);
          return null;
        }),
        transcribeAudio({ projectId, file, languageCode, model })
      ]);

      if (!transcription.transcript) {
        return res.status(422).json({
          error:
            "Speech-to-Text did not return any transcript. Try speaking more clearly or recording a shorter sample."
        });
      }

      const docRef = await firestore.collection(transcriptsCollection).add({
        transcript: transcription.transcript,
        audioUri,
        mimeType: file.mimetype,
        languageCode,
        model,
        durationMs,
        createdAt: Timestamp.now()
      });

      res.status(201).json({
        item: {
          id: docRef.id,
          transcript: transcription.transcript,
          audioUri,
          mimeType: file.mimetype,
          languageCode,
          durationMs,
          createdAt: new Date().toISOString()
        }
      });
    } catch (error) {
      console.error("Failed to create transcription", error);
      res.status(500).json({
        error:
          error.message || "Failed to transcribe and store the recording."
      });
    }
  }
);

app.get(/.*/, (_req, res) => {
  res.sendFile(path.join(__dirname, "public/index.html"));
});

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
