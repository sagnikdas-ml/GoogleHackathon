export type StudyClass = {
  id: string;
  name: string;
  code: string;
  members: string[];
};

export type NoteDoc = {
  id: string;
  classId: string;
  title: string;
  content: string;
  ownerId: string;
  collaborators: string[];
  linkedEventId?: string;
  updatedAt?: string;
};

export type EventDoc = {
  id: string;
  classId: string;
  title: string;
  startTime: string;
  endTime: string;
  createdBy: string;
  sharedWith: string[];
  noteId?: string;
  calendarEventId?: string;
};

export type TranscriptItem = {
  id: string;
  transcript: string;
  audioUri: string | null;
  mimeType: string | null;
  languageCode: string;
  model: string;
  durationMs: number | null;
  createdAt: string | null;
};
