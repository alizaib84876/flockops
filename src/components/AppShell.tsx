'use client'

import React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import styles from './AppShell.module.css'
import ThemeToggle from './ThemeToggle'
import Breadcrumb from './Breadcrumb'

interface AppShellProps {
  children: React.ReactNode
  alertCount?: number
}

export default function AppShell({ children, alertCount = 0 }: AppShellProps) {
  const pathname = usePathname()

  const NAV_ITEMS = [
    { href: '/dashboard', label: 'Home',     icon: HomeIcon },
    { href: '/sheds',     label: 'Sheds',    icon: ShedIcon },
    { href: '/alerts',    label: 'Alerts',   icon: BellIcon,    badge: alertCount },
    { href: '/settings',  label: 'Settings', icon: SettingsIcon },
  ]

  return (
    <div className={styles.shell}>
      {/* Top bar */}
      <header className="topbar">
        <Link href="/dashboard" id="logo-home-link" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div className="topbar__logo-icon">
            <ChickenIcon />
          </div>
          <span style={{ fontWeight: 800, fontSize: '1.0625rem', letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>
            FlockOps
          </span>
        </Link>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: 'auto' }}>
          {alertCount > 0 && (
            <Link href="/alerts" id="topbar-alert-badge" style={{ textDecoration: 'none' }}>
              <div style={{
                background: 'var(--red-500)',
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
              }}>
                {alertCount > 9 ? '9+' : alertCount} alert{alertCount !== 1 ? 's' : ''}
              </div>
            </Link>
          )}
          <ThemeToggle />
        </div>
      </header>

      {/* Breadcrumb strip */}
      <div style={{
        background: 'var(--bg-secondary)',
        borderBottom: '1px solid var(--border-subtle)',
        padding: '6px 16px',
      }}>
        <div style={{ maxWidth: '480px', margin: '0 auto' }}>
          <Breadcrumb />
        </div>
      </div>

      {/* Main content */}
      <main className={`${styles.main} content-with-nav`}>
        {children}
      </main>

      {/* Bottom navigation */}
      <nav className="bottom-nav" aria-label="Main navigation">
        {NAV_ITEMS.map(({ href, label, icon: Icon, badge }: { href: string; label: string; icon: () => React.ReactElement; badge?: number }) => {
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
                {badge && badge > 0 ? (
                  <span style={{
                    position: 'absolute',
                    top: '-5px',
                    right: '-7px',
                    background: 'var(--red-500)',
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
                    border: '1.5px solid var(--bg-primary)',
                  }}>
                    {badge > 9 ? '9+' : badge}
                  </span>
                ) : null}
              </div>
              <span>{label}</span>
            </Link>
          )
        })}
      </nav>
    </div>
  )
}

// ─── Icons (all SVG, no emojis) ────────────────────────────────────────────────

function ChickenIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--accent)' }}>
      <path d="M12 2C10 2 8.5 3 8 4.5c-.5 1.5.5 3 2 3.5" />
      <path d="M10 8C7 8 4 10 4 13c0 2 1 3.5 2.5 4.5L5 21h14l-1.5-3.5C19 16.5 20 15 20 13c0-3-3-5-6-5h-4z" />
      <path d="M8 21v-1" />
      <path d="M16 21v-1" />
      <circle cx="15" cy="6" r="1.5" fill="currentColor" stroke="none" />
      <path d="M15 4.5C16 3.5 17 3 17 3" />
    </svg>
  )
}

function HomeIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  )
}

function ShedIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7" />
      <path d="M9 22V12h6v10" />
      <rect x="2" y="9" width="20" height="13" rx="1" />
    </svg>
  )
}

function BellIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  )
}

function SettingsIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  )
}
