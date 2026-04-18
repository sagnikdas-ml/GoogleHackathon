'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

type ProgressData = {
  totalNotes: number;
  totalTasks: number;
  completedTasks: number;
  pendingTasks: number;
  totalEvents: number;
  completionRate: number;
};

const metrics: Array<keyof ProgressData> = [
  'totalNotes',
  'totalTasks',
  'completedTasks',
  'pendingTasks',
  'totalEvents',
  'completionRate'
];

const labels: Record<keyof ProgressData, string> = {
  totalNotes: 'Total notes',
  totalTasks: 'Total tasks',
  completedTasks: 'Completed tasks',
  pendingTasks: 'Pending tasks',
  totalEvents: 'Events',
  completionRate: 'Completion rate'
};

export default function DashboardPage() {
  const [progress, setProgress] = useState<ProgressData>({
    totalNotes: 0,
    totalTasks: 0,
    completedTasks: 0,
    pendingTasks: 0,
    totalEvents: 0,
    completionRate: 0
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadProgress() {
      try {
        const result = await api.getProgress<ProgressData>();
        setProgress(result);
      } catch (loadError) {
        console.error('Failed to load progress:', loadError);
        // Use default values on error
      } finally {
        setIsLoading(false);
      }
    }

    void loadProgress();
  }, []);

  if (isLoading) {
    return <main className="empty-state card">Loading dashboard...</main>;
  }

  return (
    <main className="stack">
      <div className="page-head">
        <div>
          <span className="badge">Progress overview</span>
          <h1 className="page-title">Track the full study workflow, including your speech-to-text pipeline.</h1>
          <p className="page-subtitle">
            These metrics are calculated from the same Firestore-backed notes, tasks, and events that power the rest of
            the app.
          </p>
        </div>
      </div>

      <section className="grid dashboard-grid">
        {metrics.map((metric) => (
          <div className="card metric-card" key={metric}>
            <p className="muted">{labels[metric]}</p>
            <div className="metric-value">
              {progress[metric]}
              {metric === 'completionRate' ? '%' : ''}
            </div>
          </div>
        ))}
      </section>

      <section className="grid grid-2">
        <div className="card insight-card">
          <h2>What to do next</h2>
          <ul className="clean-list">
            <li>Record a lecture clip in the transcript workspace and turn it into notes.</li>
            <li>Promote those notes into tasks and revision cards from the notes workspace.</li>
            <li>Attach upcoming study sessions in the events screen and share them with classmates.</li>
          </ul>
        </div>

        <div className="card insight-card">
          <h2>Current signal</h2>
          <ul className="clean-list">
            <li>{progress.pendingTasks} task(s) still open.</li>
            <li>{progress.totalEvents} event(s) currently saved.</li>
            <li>{progress.totalNotes} note(s) available for summaries and quiz generation.</li>
          </ul>
        </div>
      </section>
    </main>
  );
}
