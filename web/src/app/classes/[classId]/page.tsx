import NoteEditor from '@/components/NoteEditor';

export default function ClassPage({ params }: { params: { classId: string } }) {
  return (
    <main className="grid grid-2">
      <div className="card">
        <span className="badge">Class Workspace</span>
        <h2>{params.classId}</h2>
        <p className="muted">Shared notes, class members, linked study events, and transcript summaries.</p>
        <ul>
          <li>Members: you, friend1@example.com, friend2@example.com</li>
          <li>Next session: Tuesday 14:00</li>
          <li>Attached note room: Enabled</li>
        </ul>
      </div>
      <NoteEditor initialTitle="Lecture 5 - CAP theorem" initialContent="Consistency, availability, partition tolerance..." />
    </main>
  );
}
