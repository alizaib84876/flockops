'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import styles from './AppShell.module.css'

interface AppShellProps {
  children: React.ReactNode
  alertCount?: number
}

export default function AppShell({ children, alertCount = 0 }: AppShellProps) {
  const pathname = usePathname()

  const NAV_ITEMS = [
    { href: '/dashboard', label: 'Home',     icon: HomeIcon,     badge: 0 },
    { href: '/sheds',     label: 'Sheds',    icon: ShedIcon,     badge: 0 },
    { href: '/alerts',    label: 'Alerts',   icon: AlertIcon,    badge: alertCount },
    { href: '/settings',  label: 'Settings', icon: SettingsIcon, badge: 0 },
  ]

  return (
    <div className={styles.shell}>
      {/* Top bar */}
      <header className="topbar">
        <div className="topbar__logo">
          <div className="topbar__logo-icon">🐔</div>
          <span>FlockOps</span>
        </div>
        {alertCount > 0 && (
          <Link href="/alerts" style={{ textDecoration: 'none' }}>
            <div style={{
              background: 'var(--red-400)',
              color: '#fff',
              fontWeight: 800,
              fontSize: '0.75rem',
              minWidth: '22px',
              height: '22px',
              borderRadius: '11px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0 6px',
              animation: 'pulse 2s infinite',
            }}>
              {alertCount > 9 ? '9+' : alertCount}
            </div>
          </Link>
        )}
      </header>

      {/* Main content */}
      <main className={`${styles.main} content-with-nav`}>
        {children}
      </main>

      {/* Bottom navigation */}
      <nav className="bottom-nav" aria-label="Main navigation">
        {NAV_ITEMS.map(({ href, label, icon: Icon, badge }) => {
          const isActive = pathname === href || (href !== '/dashboard' && pathname.startsWith(href))
          return (
            <Link
              key={href}
              href={href}
              className={`bottom-nav__item ${isActive ? 'bottom-nav__item--active' : ''}`}
              aria-current={isActive ? 'page' : undefined}
              id={`nav-${label.toLowerCase()}`}
            >
              <div style={{ position: 'relative', display: 'inline-flex' }}>
                <Icon />
                {badge > 0 && (
                  <span style={{
                    position: 'absolute',
                    top: '-5px',
                    right: '-7px',
                    background: 'var(--red-400)',
                    color: '#fff',
                    fontWeight: 800,
                    fontSize: '0.6rem',
                    minWidth: '16px',
                    height: '16px',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '0 3px',
                    lineHeight: 1,
                    border: '1.5px solid var(--bg-base)',
                  }}>
                    {badge > 9 ? '9+' : badge}
                  </span>
                )}
              </div>
              <span>{label}</span>
            </Link>
          )
        })}
      </nav>
    </div>
  )
}

function HomeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12L12 3l9 9" />
      <path d="M9 21V12h6v9" />
      <path d="M3 12v9h18v-9" />
    </svg>
  )
}

function ShedIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="7" width="20" height="14" rx="2" />
      <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
      <line x1="12" y1="12" x2="12" y2="17" />
      <line x1="9" y1="14.5" x2="15" y2="14.5" />
    </svg>
  )
}

function AlertIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  )
}

function SettingsIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  )
}
