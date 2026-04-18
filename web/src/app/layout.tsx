import './globals.css';
import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Study Buddy',
  description: 'Hackathon starter for collaborative study workflows'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="container">
          <header className="hero">
            <div className="row space-between">
              <div>
                <h1 style={{ margin: 0 }}>Study Buddy</h1>
                <p className="muted">Notes, calendar, transcript-to-notes, quiz, and shared class events.</p>
              </div>
              <Link className="btn secondary" href="/">Home</Link>
            </div>
            <nav className="nav">
              <Link href="/dashboard">Dashboard</Link>
              <Link href="/classes/demo-class">Class Workspace</Link>
              <Link href="/events">Events</Link>
              <Link href="/transcript">Transcript</Link>
              <Link href="/quiz">Quiz</Link>
            </nav>
          </header>
          {children}
        </div>
      </body>
    </html>
  );
}
