# SpeechText App

Small App Engine web app that lets a user:

- record audio in the browser
- transcribe it with Google Cloud Speech-to-Text
- store transcript metadata in Firestore
- optionally save the raw audio file in Cloud Storage

## Stack

- Node.js + Express
- Google Cloud Speech-to-Text
- Firestore
- Cloud Storage
- App Engine Standard

## Required Google Cloud setup

Enable these APIs in the target project:

- `speech.googleapis.com`
- `firestore.googleapis.com`
- `storage.googleapis.com`
- `appengine.googleapis.com`

Create a Firestore database in Native mode if you have not already.

The App Engine default service account needs permission to use:

- Speech-to-Text
- Firestore
- Cloud Storage

## Local run

Install dependencies:

```bash
npm install
```

Start the app:

```bash
npm start
```

For local development, authenticate with Application Default Credentials:

```bash
gcloud auth application-default login
```

The app expects `GOOGLE_CLOUD_PROJECT` to be available. Example:

```bash
export GOOGLE_CLOUD_PROJECT="your-project-id"
```

Optional environment variables:

- `TRANSCRIPTS_BUCKET`: Cloud Storage bucket for uploaded audio. If omitted, the app tries `${GOOGLE_CLOUD_PROJECT}.appspot.com`.
- `TRANSCRIPTS_COLLECTION`: Firestore collection name. Default: `transcriptions`.
- `TRANSCRIPTS_LANGUAGE`: Default language code. Default: `en-US`.
- `TRANSCRIPTS_MODEL`: Speech model. Default: `short`.

## Deploy to App Engine

From the repo root:

```bash
gcloud app deploy
```

After deploy:

```bash
gcloud app browse
```

## Notes

- The frontend records audio as `webm` with Opus when supported.
- Transcript text is always written to Firestore.
- If Cloud Storage upload fails, the app still saves the transcript in Firestore.
