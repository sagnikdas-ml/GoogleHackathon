# Project Structure

```text
study-buddy-hackathon/
├── README.md
├── firebase.json
├── firestore.rules
├── firestore.indexes.json
├── .firebaserc.example
├── docs/
│   └── PROJECT_STRUCTURE.md
├── web/
│   ├── package.json
│   ├── tsconfig.json
│   ├── next.config.mjs
│   ├── next-env.d.ts
│   ├── .env.example
│   └── src/
│       ├── app/
│       │   ├── layout.tsx
│       │   ├── page.tsx
│       │   ├── globals.css
│       │   ├── dashboard/page.tsx
│       │   ├── classes/[classId]/page.tsx
│       │   ├── events/page.tsx
│       │   ├── transcript/page.tsx
│       │   └── quiz/page.tsx
│       ├── components/
│       │   ├── AuthButtons.tsx
│       │   ├── EventShareForm.tsx
│       │   ├── NoteEditor.tsx
│       │   ├── TranscriptPanel.tsx
│       │   └── QuizGenerator.tsx
│       └── lib/
│           ├── api.ts
│           ├── firebase.ts
│           └── types.ts
└── functions/
    ├── package.json
    ├── tsconfig.json
    ├── .env.example
    └── src/
        ├── google.ts
        ├── utils.ts
        └── index.ts
```

## Important hackathon shortcuts

- `transcribeAudio` is a stub so the demo still works even if Speech-to-Text is not fully configured.
- Quiz generation and transcript summarization are rule-based to keep costs low.
- Firestore rules are minimal and should be tightened after the hackathon.
