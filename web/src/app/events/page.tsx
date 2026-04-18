'use client';

import { useEffect, useState } from 'react';
import EventShareForm from '@/components/EventShareForm';
import { api } from '@/lib/api';

type EventItem = {
  id: string;
  title: string;
  subject?: string;
  startTime: string;
  endTime?: string;
};

export default function EventsPage() {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [editId, setEditId] = useState<string | null>(null);
  const [status, setStatus] = useState('');

  async function loadEvents() {
    try {
      const result = await api.getEvents<EventItem[]>();
      setEvents(result);
    } catch (error) {
      console.error('Failed to load events:', error);
      // Silently fail and show empty events list
    }
  }

  useEffect(() => {
    void loadEvents();
  }, []);

  async function handleCreate() {
    try {
      await api.createEvent({ title, subject, startTime, endTime });
      setTitle('');
      setSubject('');
      setStartTime('');
      setEndTime('');
      setStatus('Event created.');
      await loadEvents();
    } catch (error) {
      console.error(error);
      setStatus(error instanceof Error ? error.message : 'Failed to create event.');
    }
  }

  async function handleUpdate() {
    if (!editId) {
      return;
    }

    try {
      await api.updateEvent(editId, { title, subject, startTime, endTime });
      setEditId(null);
      setTitle('');
      setSubject('');
      setStartTime('');
      setEndTime('');
      setStatus('Event updated.');
      await loadEvents();
    } catch (error) {
      console.error(error);
      setStatus(error instanceof Error ? error.message : 'Failed to update event.');
    }
  }

  async function handleDelete(id: string) {
    try {
      await api.deleteEvent(id);
      setStatus('Event deleted.');
      await loadEvents();
    } catch (error) {
      console.error(error);
      setStatus(error instanceof Error ? error.message : 'Failed to delete event.');
    }
  }

  function handleEdit(event: EventItem) {
    setEditId(event.id);
    setTitle(event.title);
    setSubject(event.subject || '');
    setStartTime(event.startTime);
    setEndTime(event.endTime || '');
  }

  return (
    <main className="stack">
      <div className="page-head">
        <div>
          <span className="badge">Event center</span>
          <h1 className="page-title">Create internal study events and share calendar sessions from one place.</h1>
          <p className="page-subtitle">
            This combines the reference branch event manager with the existing Google Calendar sharing flow.
          </p>
        </div>
      </div>

      <section className="grid grid-2">
        <EventShareForm />

        <div className="card">
          <h3 style={{ marginTop: 0 }}>{editId ? 'Edit study event' : 'Create study event'}</h3>

          <div className="form-grid">
            <label className="field" style={{ gridColumn: '1 / -1' }}>
              <span>Title</span>
              <input className="input" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="ML revision session" />
            </label>

            <label className="field">
              <span>Subject</span>
              <input className="input" value={subject} onChange={(event) => setSubject(event.target.value)} placeholder="Machine learning" />
            </label>

            <label className="field">
              <span>Start time</span>
              <input
                className="input"
                value={startTime}
                onChange={(event) => setStartTime(event.target.value)}
                placeholder="2026-04-20T10:00:00"
              />
            </label>

            <label className="field" style={{ gridColumn: '1 / -1' }}>
              <span>End time</span>
              <input
                className="input"
                value={endTime}
                onChange={(event) => setEndTime(event.target.value)}
                placeholder="2026-04-20T12:00:00"
              />
            </label>
          </div>

          <div className="actions">
            {editId ? (
              <button className="btn" onClick={handleUpdate}>
                Update
              </button>
            ) : (
              <button className="btn" onClick={handleCreate}>
                Create
              </button>
            )}
          </div>

          {status ? <p className="status-text">{status}</p> : null}
        </div>
      </section>

      <section className="card">
        <div className="row space-between section-head">
          <div>
            <h2>Saved events</h2>
            <p className="muted">These are the internal event records stored in Firestore.</p>
          </div>
        </div>

        <div className="list-stack">
          {events.length ? (
            events.map((event) => (
              <div key={event.id} className="item-card dense-card">
                <div className="row space-between">
                  <div>
                    <strong>{event.title}</strong>
                    <p className="muted">
                      {[event.subject, event.startTime ? `Start ${event.startTime}` : '', event.endTime ? `End ${event.endTime}` : '']
                        .filter(Boolean)
                        .join(' • ')}
                    </p>
                  </div>

                  <div className="actions">
                    <button className="btn secondary" onClick={() => handleEdit(event)}>
                      Edit
                    </button>
                    <button className="btn danger" onClick={() => void handleDelete(event.id)}>
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="empty-state">No events yet.</div>
          )}
        </div>
      </section>
    </main>
  );
}
