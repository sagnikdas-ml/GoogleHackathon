# Study Buddy Hackathon

Hackathon-ready starter for a student collaboration app with:

- Google sign-in via Firebase Auth
- Shared notes in Firestore
- Shared class events
- Google Calendar event creation
- Lecture audio recording/upload + Speech-to-Text transcription history
- Transcript-to-notes conversion
- Quiz generation from notes
- Export notes to Google Docs

## Stack

- Next.js 14 + TypeScript
- Firebase Auth + Firestore
- App Engine compatible Next.js frontend
- Firebase Functions (Node.js / TypeScript)
- Google Calendar API
- Google Docs API
- Google Drive API
- Cloud Speech-to-Text

## Monorepo structure

```text
study-buddy-hackathon/
  web/                  # Next.js frontend
  functions/            # Firebase Cloud Functions API
  firestore.rules
  firestore.indexes.json
  firebase.json
  .firebaserc.example
```

## Quick start

### 1) Create Firebase + GCP project

Enable:
- Firebase Authentication (Google provider)
- Firestore
- Cloud Functions
- Google Calendar API
- Google Docs API
- Google Drive API
- Cloud Speech-to-Text API

### 2) Frontend env

Copy `web/.env.example` to `web/.env.local` and fill values.

### 3) Functions env

Copy `functions/.env.example` to `functions/.env` and fill values.

### 4) Install

```bash
cd web && npm install
cd ../functions && npm install
```

### 5) Run locally

```bash
cd web
npm run dev
```

### 6) Deploy functions

```bash
cd functions
npm run build
firebase deploy --only functions
```

### 7) Deploy the Next.js frontend to App Engine

Update `web/app.yaml` with your Firebase web config and the deployed `FUNCTIONS_BASE_URL`, then run:

```bash
cd web
gcloud app deploy
```

## Notes

- This is optimized for hackathon speed, not final production hardening.
- Transcript summarization is rule-based to avoid GenAI costs.
- Speech-to-Text uses Google Cloud ADC in deployed environments and can optionally write raw audio to Cloud Storage.
- Calendar sharing happens by inviting the friend's email to the event and linking a shared note in Firestore.
