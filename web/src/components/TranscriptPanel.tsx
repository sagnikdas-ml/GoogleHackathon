'use client';

import { useState } from 'react';
import { api } from '@/lib/api';

export default function TranscriptPanel() {
  const [transcript, setTranscript] = useState('Professor: Today we study CAP theorem and tradeoffs in distributed systems.');
  const [summary, setSummary] = useState('');

  const handleSummarize = async () => {
    try {
      const result = await api.summarizeTranscript({ transcript }) as { notes: string };
      setSummary(result.notes);
    } catch (error) {
      console.error(error);
      alert('Transcript summarization failed.');
    }
  };

  return (
    <div className="grid grid-2">
      <div className="card">
        <h3 style={{ marginTop: 0 }}>Transcript</h3>
        <textarea className="textarea" value={transcript} onChange={(e) => setTranscript(e.target.value)} />
        <div style={{ height: 12 }} />
        <button className="btn" onClick={handleSummarize}>Convert to notes</button>
      </div>
      <div className="card">
        <h3 style={{ marginTop: 0 }}>Generated Notes</h3>
        <textarea className="textarea" value={summary} onChange={(e) => setSummary(e.target.value)} />
      </div>
    </div>
  );
}
