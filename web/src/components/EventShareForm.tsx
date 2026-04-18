'use client';

import { useState } from 'react';
import { api } from '@/lib/api';

export default function EventShareForm() {
  const [title, setTitle] = useState('Cloud Computing Review Session');
  const [friendEmail, setFriendEmail] = useState('friend@example.com');
  const [startTime, setStartTime] = useState('2026-04-20T18:00:00');
  const [endTime, setEndTime] = useState('2026-04-20T19:30:00');
  const [result, setResult] = useState('');

  const handleCreate = async () => {
    try {
      const data = await api.createCalendarEvent({
        title,
        attendeeEmails: [friendEmail],
        startTime,
        endTime,
        description: 'Shared study event with shared note attached in Study Buddy'
      }) as { htmlLink?: string };
      setResult(data.htmlLink || 'Event created');
    } catch (error) {
      console.error(error);
      alert('Calendar event creation failed. Check API credentials.');
    }
  };

  return (
    <div className="card">
      <h3 style={{ marginTop: 0 }}>Share class event with a friend</h3>
      <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Event title" />
      <div style={{ height: 12 }} />
      <input className="input" value={friendEmail} onChange={(e) => setFriendEmail(e.target.value)} placeholder="Friend email" />
      <div style={{ height: 12 }} />
      <div className="grid grid-2">
        <input className="input" value={startTime} onChange={(e) => setStartTime(e.target.value)} placeholder="Start time ISO" />
        <input className="input" value={endTime} onChange={(e) => setEndTime(e.target.value)} placeholder="End time ISO" />
      </div>
      <div style={{ height: 12 }} />
      <button className="btn" onClick={handleCreate}>Create shared event</button>
      {result ? <p><a className="badge" href={result} target="_blank">Open Calendar Event</a></p> : null}
    </div>
  );
}
