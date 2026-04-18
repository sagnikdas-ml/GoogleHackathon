'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

type Note = {
  id: string;
  title: string;
  subject?: string;
  createdAt?: string | null;
};

type Task = {
  id: string;
  title: string;
  subject?: string;
  priority?: string;
  status?: string;
  createdAt?: string | null;
};

type EventItem = {
  id: string;
  title: string;
  subject?: string;
  startTime?: string;
  createdAt?: string | null;
};

type FeedState = {
  notes: Note[];
  tasks: Task[];
  events: EventItem[];
};

const emptyFeed: FeedState = {
  notes: [],
  tasks: [],
  events: []
};

export default function HomePage() {
  const [feed, setFeed] = useState<FeedState>(emptyFeed);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadFeed() {
      try {
        const [notes, tasks, events] = await Promise.all([
          api.getNotes<Note[]>(),
          api.getTasks<Task[]>(),
          api.getEvents<EventItem[]>()
        ]);

        const sortByCreatedAt = <T extends { createdAt?: string | null }>(items: T[]) =>
          [...items]
            .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
            .slice(0, 4);

        setFeed({
          notes: sortByCreatedAt(notes),
          tasks: sortByCreatedAt(tasks),
          events: sortByCreatedAt(events)
        });
      } catch (loadError) {
        console.error(loadError);
        setError(loadError instanceof Error ? loadError.message : 'Failed to load the study dashboard.');
      } finally {
        setLoading(false);
      }
    }

    void loadFeed();
  }, []);

  return (
    <main className="stack">
      <section className="hero-panel">
        <div className="hero-copy">
          <span className="badge">Reference UI merged into main</span>
          <h1 className="page-title">Your study hub now keeps notes, tasks, events, and speech-to-text in one flow.</h1>
          <p className="page-subtitle">
            The broader app structure from the reference branch is back on `main`, with the richer recording and
            transcription workflow preserved as the centerpiece.
          </p>
        </div>

        <div className="hero-actions">
          <Link href="/transcript" className="btn">
            Open Speech Studio
          </Link>
          <Link href="/notes" className="btn secondary">
            Manage Notes
          </Link>
        </div>
      </section>

      <section className="grid grid-3">
        <Link href="/transcript" className="feature-card">
          <span className="feature-eyebrow">Speech to text</span>
          <h2>Record, upload, transcribe, and convert lectures into notes.</h2>
          <p>Microphone recording, audio preview, saved transcription history, and note generation stay on `main`.</p>
        </Link>

        <Link href="/events" className="feature-card">
          <span className="feature-eyebrow">Collaboration</span>
          <h2>Manage study events and share sessions through Google Calendar.</h2>
          <p>Create internal events or send a shared calendar invite from the same screen.</p>
        </Link>

        <Link href="/quiz" className="feature-card">
          <span className="feature-eyebrow">Revision</span>
          <h2>Turn study material into quick quiz prompts for active recall.</h2>
          <p>Use the quiz workspace directly or generate questions while editing notes.</p>
        </Link>
      </section>

      {loading ? (
        <section className="card empty-state">Loading recent activity...</section>
      ) : error ? (
        <section className="card empty-state">{error}</section>
      ) : (
        <section className="grid grid-3">
          <FeedColumn
            title="Recent Notes"
            href="/notes"
            emptyLabel="No notes yet."
            items={feed.notes.map((item) => ({
              id: item.id,
              title: item.title,
              meta: item.subject || 'General study note'
            }))}
          />
          <FeedColumn
            title="Recent Tasks"
            href="/tasks"
            emptyLabel="No tasks yet."
            items={feed.tasks.map((item) => ({
              id: item.id,
              title: item.title,
              meta: [item.subject, item.priority, item.status].filter(Boolean).join(' • ') || 'Task'
            }))}
          />
          <FeedColumn
            title="Recent Events"
            href="/events"
            emptyLabel="No events yet."
            items={feed.events.map((item) => ({
              id: item.id,
              title: item.title,
              meta: item.startTime ? new Date(item.startTime).toLocaleString() : item.subject || 'Study event'
            }))}
          />
        </section>
      )}
    </main>
  );
}

function FeedColumn({
  title,
  href,
  emptyLabel,
  items
}: {
  title: string;
  href: string;
  emptyLabel: string;
  items: Array<{ id: string; title: string; meta: string }>;
}) {
  return (
    <section className="card">
      <div className="row space-between section-head">
        <div>
          <h2>{title}</h2>
          <p className="muted">Latest activity synced from Firestore.</p>
        </div>
        <Link href={href} className="badge text-link">
          View all
        </Link>
      </div>

      <div className="list-stack">
        {items.length ? (
          items.map((item) => (
            <div key={item.id} className="item-card">
              <strong>{item.title}</strong>
              <p className="muted">{item.meta}</p>
            </div>
          ))
        ) : (
          <div className="empty-state">{emptyLabel}</div>
        )}
      </div>
    </section>
  );
}
