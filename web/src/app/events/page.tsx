import EventShareForm from '@/components/EventShareForm';

export default function EventsPage() {
  return (
    <main className="grid grid-2">
      <EventShareForm />
      <div className="card">
        <h3 style={{ marginTop: 0 }}>How it works</h3>
        <ol>
          <li>Create a study event in Google Calendar.</li>
          <li>Invite a friend in the same class.</li>
          <li>Create or attach a shared note in Firestore.</li>
          <li>Keep transcript summary linked to the event.</li>
        </ol>
      </div>
    </main>
  );
}
