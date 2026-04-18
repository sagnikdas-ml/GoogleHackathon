'use client';

import { useState } from 'react';
import { api } from '@/lib/api';

type Props = {
  initialTitle?: string;
  initialContent?: string;
};

export default function NoteEditor({ initialTitle = 'Shared Note', initialContent = '' }: Props) {
  const [title, setTitle] = useState(initialTitle);
  const [content, setContent] = useState(initialContent);
  const [docUrl, setDocUrl] = useState('');

  const handleExport = async () => {
    try {
      const result = await api.exportNotesToDoc({
        title,
        content,
        shareWith: []
      }) as { documentUrl?: string };
      setDocUrl(result.documentUrl || '');
    } catch (error) {
      console.error(error);
      alert('Export failed. Configure Docs and Drive API credentials.');
    }
  };

  return (
    <div className="card">
      <div className="row space-between">
        <h3 style={{ margin: 0 }}>Collaborative Note</h3>
        <button className="btn secondary" onClick={handleExport}>Export to Google Docs</button>
      </div>
      <div style={{ height: 12 }} />
      <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Note title" />
      <div style={{ height: 12 }} />
      <textarea className="textarea" value={content} onChange={(e) => setContent(e.target.value)} placeholder="Write or paste lecture notes here" />
      {docUrl ? <p><a className="badge" href={docUrl} target="_blank">Open exported Google Doc</a></p> : null}
    </div>
  );
}
