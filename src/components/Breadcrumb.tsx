'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

// Maps URL segments to readable labels
const SEGMENT_LABELS: Record<string, string> = {
  dashboard: 'Dashboard',
  sheds: 'Sheds',
  batches: 'Batches',
  growth: 'Growth',
  log: 'Daily Log',
  financials: 'Financials',
  expenses: 'Expenses',
  new: 'New',
  edit: 'Edit',
  sales: 'Sales',
  weights: 'Weights',
  close: 'Close Batch',
  alerts: 'Alerts',
  settings: 'Settings',
}

function isUUID(s: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)
}

export default function Breadcrumb() {
  const pathname = usePathname()
  const segments = pathname.split('/').filter(Boolean)

  // Don't show breadcrumb on top-level pages
  if (segments.length <= 1) return null

  const crumbs: { label: string; href: string }[] = []
  let path = ''

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i]
    path += '/' + seg

    // Skip UUIDs in the display — they'll be replaced by their parent segment's label
    if (isUUID(seg)) continue
    // Skip 'batches' and 'weights' connector segments — not useful as standalone crumbs
    if (seg === 'batches' || seg === 'weights') continue

    const label = SEGMENT_LABELS[seg] ?? seg
    crumbs.push({ label, href: path })
  }

  if (crumbs.length <= 1) return null

  return (
    <nav
      aria-label="Breadcrumb"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        fontSize: '0.8125rem',
        color: 'var(--text-muted)',
        overflowX: 'auto',
        WebkitOverflowScrolling: 'touch',
        scrollbarWidth: 'none',
        paddingBottom: '1px',
        flexWrap: 'nowrap',
        whiteSpace: 'nowrap',
      }}
    >
      {crumbs.map((crumb, i) => {
        const isLast = i === crumbs.length - 1
        return (
          <span key={crumb.href} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            {i > 0 && (
              <ChevronIcon />
            )}
            {isLast ? (
              <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{crumb.label}</span>
            ) : (
              <Link
                href={crumb.href}
                style={{
                  color: 'var(--text-muted)',
                  textDecoration: 'none',
                  transition: 'color 150ms ease',
                }}
              >
                {crumb.label}
              </Link>
            )}
          </span>
        )
      })}
    </nav>
  )
}

function ChevronIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <path d="M9 18l6-6-6-6" />
    </svg>
  )
}
