'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

type NoteItem = {
  id: string;
  title: string;
  content: string;
  subject?: string;
};

type QuizQuestion = {
  question: string;
  answer: string;
  options?: string[];
};

type SummaryResponse = {
  summary: string;
};

type QuizResponse = {
  questions: QuizQuestion[];
};

export default function NotesPage() {
  const [notes, setNotes] = useState<NoteItem[]>([]);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [subject, setSubject] = useState('');
  const [editId, setEditId] = useState<string | null>(null);
  const [status, setStatus] = useState('');
  const [summary, setSummary] = useState('');
  const [quiz, setQuiz] = useState<QuizQuestion[]>([]);

  async function loadNotes() {
    try {
      const result = await api.getNotes<NoteItem[]>();
      setNotes(result);
    } catch (error) {
      console.error(error);
      setStatus(error instanceof Error ? error.message : 'Failed to load notes.');
    }
  }

  useEffect(() => {
    void loadNotes();
  }, []);

  function resetForm() {
    setEditId(null);
    setTitle('');
    setContent('');
    setSubject('');
  }

  async function handleCreate() {
    try {
      await api.createNote({ title, content, subject });
      resetForm();
      setStatus('Note created.');
      await loadNotes();
    } catch (error) {
      console.error(error);
      setStatus(error instanceof Error ? error.message : 'Failed to create note.');
    }
  }

  async function handleUpdate() {
    if (!editId) {
      return;
    }

    try {
      await api.updateNote(editId, { title, content, subject });
      resetForm();
      setStatus('Note updated.');
      await loadNotes();
    } catch (error) {
      console.error(error);
      setStatus(error instanceof Error ? error.message : 'Failed to update note.');
    }
  }

  async function handleDelete(id: string) {
    try {
      await api.deleteNote(id);
      setStatus('Note deleted.');
      await loadNotes();
    } catch (error) {
      console.error(error);
      setStatus(error instanceof Error ? error.message : 'Failed to delete note.');
    }
  }

  function handleEdit(note: NoteItem) {
    setEditId(note.id);
    setTitle(note.title);
    setContent(note.content);
    setSubject(note.subject || '');
    setSummary('');
    setQuiz([]);
  }

  async function handleSummarize() {
    try {
      const result = await api.summarizeText<SummaryResponse>(content);
      setSummary(result.summary);
      setStatus('Summary generated.');
    } catch (error) {
      console.error(error);
      setStatus(error instanceof Error ? error.message : 'Failed to summarize note.');
    }
  }

  async function handleGenerateQuiz() {
    try {
      const result = await api.generateQuiz<QuizResponse>(content);
      setQuiz(result.questions || []);
      setStatus('Quiz generated.');
    } catch (error) {
      console.error(error);
      setStatus(error instanceof Error ? error.message : 'Failed to generate quiz.');
    }
  }

  return (
    <main className="stack">
      <div className="page-head">
        <div>
          <span className="badge">Notes workspace</span>
          <h1 className="page-title">Capture study notes and turn them into summaries or revision questions.</h1>
          <p className="page-subtitle">This restores the reference branch workflow while using the current functions API.</p>
        </div>
      </div>

      <section className="card">
        <h2>{editId ? 'Edit note' : 'Create note'}</h2>

        <div className="form-grid">
          <label className="field" style={{ gridColumn: '1 / -1' }}>
            <span>Title</span>
            <input className="input" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Distributed systems review" />
          </label>

          <label className="field" style={{ gridColumn: '1 / -1' }}>
            <span>Content</span>
            <textarea
              className="textarea"
              value={content}
              onChange={(event) => setContent(event.target.value)}
              placeholder="Write or paste the study note here."
            />
          </label>

          <label className="field" style={{ gridColumn: '1 / -1' }}>
            <span>Subject</span>
            <input className="input" value={subject} onChange={(event) => setSubject(event.target.value)} placeholder="Cloud computing" />
          </label>
        </div>

        <div className="actions">
          {editId ? (
            <button className="btn" onClick={handleUpdate}>
              Update Note
            </button>
          ) : (
            <button className="btn" onClick={handleCreate}>
              Create Note
            </button>
          )}

          <button className="btn secondary" onClick={handleSummarize}>
            Summarize
          </button>
          <button className="btn secondary" onClick={handleGenerateQuiz}>
            Generate Quiz
          </button>
        </div>

        {status ? <p className="status-text">{status}</p> : null}
      </section>

      {(summary || quiz.length > 0) && (
        <section className="grid grid-2">
          <div className="card">
            <h3>Summary</h3>
            <pre className="formatted-output">{summary || 'Generate a summary from the current note.'}</pre>
          </div>

          <div className="card">
            <h3>Quiz</h3>
            <div className="list-stack">
              {quiz.length ? (
                quiz.map((question, index) => (
                  <div className="item-card" key={`${question.question}-${index}`}>
                    <strong>
                      Q{index + 1}. {question.question}
                    </strong>
                    {question.options?.length ? (
                      <ul className="clean-list">
                        {question.options.map((option) => (
                          <li key={option}>{option}</li>
                        ))}
                      </ul>
                    ) : null}
                    <p className="muted">Answer: {question.answer}</p>
                  </div>
                ))
              ) : (
                <div className="empty-state">Generate a quiz from the current note.</div>
              )}
            </div>
          </div>
        </section>
      )}

      <section className="card">
        <div className="row space-between section-head">
          <div>
            <h2>All notes</h2>
            <p className="muted">Every saved note is available for editing, summarizing, and quiz generation.</p>
          </div>
        </div>

        <div className="list-stack">
          {notes.length ? (
            notes.map((note) => (
              <div key={note.id} className="item-card dense-card">
                <div className="row space-between">
                  <div>
                    <strong>{note.title}</strong>
                    {note.subject ? <p className="muted">{note.subject}</p> : null}
                  </div>
                  <div className="actions">
                    <button className="btn secondary" onClick={() => handleEdit(note)}>
                      Edit
                    </button>
                    <button className="btn danger" onClick={() => void handleDelete(note.id)}>
                      Delete
                    </button>
                  </div>
                </div>
                <p>{note.content}</p>
              </div>
            ))
          ) : (
            <div className="empty-state">No notes yet.</div>
          )}
        </div>
      </section>
    </main>
  );
}
