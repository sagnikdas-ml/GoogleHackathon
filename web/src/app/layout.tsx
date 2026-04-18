import './globals.css';
import type { Metadata } from 'next';
import Navbar from '@/components/Navbar';

export const metadata: Metadata = {
  title: 'Study Buddy',
  description: 'Notes, tasks, events, quizzes, and speech-to-text study workflows.'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Navbar />
        <div className="app-shell">{children}</div>
      </body>
    </html>
  );
}
