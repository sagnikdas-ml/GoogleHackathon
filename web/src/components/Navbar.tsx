'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const links = [
  { href: '/', label: 'Home' },
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/notes', label: 'Notes' },
  { href: '/tasks', label: 'Tasks' },
  { href: '/events', label: 'Events' },
  { href: '/transcript', label: 'Transcript' },
  { href: '/quiz', label: 'Quiz' }
];

export default function Navbar() {
  const pathname = usePathname();

  return (
    <nav className="navbar">
      <div className="navbar-inner">
        <Link href="/" className="brand-link">
          <span className="brand-mark">SB</span>
          <span>
            <strong>Study Buddy</strong>
            <small>Hackathon workspace</small>
          </span>
        </Link>

        <div className="navbar-links">
          {links.map((link) => {
            const active = pathname === link.href;

            return (
              <Link key={link.href} href={link.href} className={`nav-link${active ? ' active' : ''}`}>
                {link.label}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
