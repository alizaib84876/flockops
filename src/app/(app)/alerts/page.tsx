import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export const metadata = {
  title: 'Alerts — FlockOps',
  description: 'Mortality spikes, low feed stock, and missing daily log warnings for all active sheds.',
}

// ─── Types ────────────────────────────────────────────────────────────────────

type AlertSeverity = 'critical' | 'warning' | 'info'

interface Alert {
  id: string
  type: 'mortality_spike' | 'low_feed_stock' | 'missing_log' | 'high_mortality_cumulative'
  severity: AlertSeverity
  shedName: string
  batchId: string
  shedId: string
  title: string
  detail: string
  actionLabel: string
  actionHref: string
  triggeredAt: string // ISO string — when condition was first met
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function todayStr() {
  return new Date().toISOString().split('T')[0]
}

function daysAgo(n: number) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().split('T')[0]
}

function severityConfig(s: AlertSeverity) {
  switch (s) {
    case 'critical': return { icon: '🔴', label: 'Critical', color: 'var(--red-400)', bg: 'rgba(239,68,68,0.06)', border: 'rgba(239,68,68,0.25)' }
    case 'warning':  return { icon: '🟡', label: 'Warning',  color: 'var(--amber-400)', bg: 'rgba(245,158,11,0.06)', border: 'rgba(245,158,11,0.25)' }
    case 'info':     return { icon: '🔵', label: 'Info',     color: '#60a5fa', bg: 'rgba(96,165,250,0.06)', border: 'rgba(96,165,250,0.2)' }
  }
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit' })
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function AlertsPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: userData } = await supabase
    .from('users')
    .select('farm_id')
    .eq('id', user.id)
    .single()
  const farmId = (userData as { farm_id: string | null } | null)?.farm_id

  if (!farmId) {
    return (
      <div className="container" style={{ paddingTop: '32px' }}>
        <div className="empty-state">
          <div className="empty-state__icon">🔔</div>
          <div className="empty-state__title">No farm set up yet</div>
          <div className="empty-state__desc">Create your farm to start receiving alerts.</div>
        </div>
      </div>
    )
  }

  // ── Fetch all data needed for alert computation ────────────────────────────
  const { data: shedsData } = await supabase
    .from('sheds')
    .select('id, name')
    .eq('farm_id', farmId)

  const allSheds = shedsData ?? []
  const shedIds = allSheds.map(s => s.id)

  if (shedIds.length === 0) {
    return <NoAlertsState reason="No sheds configured." />
  }

  // Active batches
  const { data: batchesData } = await supabase
    .from('batches')
    .select('id, shed_id, breed, starting_bird_count, placement_date')
    .in('shed_id', shedIds)
    .eq('status', 'active')

  const activeBatches = batchesData ?? []
  const activeBatchIds = activeBatches.map(b => b.id)

  if (activeBatchIds.length === 0) {
    return <NoAlertsState reason="No active batches." />
  }

  const today = todayStr()
  const threeDaysAgo = daysAgo(3)

  // Logs for the last 4 days (today + 3 previous) — enough for spike detection
  const { data: recentLogsData } = await supabase
    .from('daily_logs')
    .select('batch_id, log_date, mortality_count, feed_given_kg, feed_stock_remaining_kg')
    .in('batch_id', activeBatchIds)
    .gte('log_date', threeDaysAgo)
    .order('log_date', { ascending: false })

  // All logs for cumulative mortality
  const { data: allLogsData } = await supabase
    .from('daily_logs')
    .select('batch_id, mortality_count')
    .in('batch_id', activeBatchIds)

  const recentLogs = recentLogsData ?? []
  const allLogs = allLogsData ?? []

  // Today's log set (server-side verified)
  const { data: todayLogsData } = await supabase
    .from('daily_logs')
    .select('batch_id, feed_stock_remaining_kg')
    .in('batch_id', activeBatchIds)
    .eq('log_date', today)

  const todayLogs = todayLogsData ?? []
  const todayLoggedIds = new Set(todayLogs.map(l => l.batch_id))

  // Shed name lookup
  const shedNameById: Record<string, string> = {}
  allSheds.forEach(s => { shedNameById[s.id] = s.name })

  // ── Compute alerts ─────────────────────────────────────────────────────────
  const alerts: Alert[] = []
  const now = new Date().toISOString()

  for (const batch of activeBatches) {
    const shedName = shedNameById[batch.shed_id] ?? 'Unknown Shed'
    const batchLogs = recentLogs.filter(l => l.batch_id === batch.id)
    const allBatchLogs = allLogs.filter(l => l.batch_id === batch.id)
    const todayLog = todayLogs.find(l => l.batch_id === batch.id)

    // ── 1. Missing daily log ──────────────────────────────────────────────────
    if (!todayLoggedIds.has(batch.id)) {
      alerts.push({
        id: `missing-log-${batch.id}`,
        type: 'missing_log',
        severity: 'warning',
        shedName,
        batchId: batch.id,
        shedId: batch.shed_id,
        title: `Daily log not submitted — ${shedName}`,
        detail: `Today's mortality, feed, and water readings have not been entered yet.`,
        actionLabel: 'Enter Today\'s Log',
        actionHref: `/sheds/${batch.shed_id}/batches/${batch.id}/log`,
        triggeredAt: now,
      })
    }

    // ── 2. Mortality spike: today > 2× the 3-day rolling average ─────────────
    const todayMortality = batchLogs.find(l => l.log_date === today)
    const prior3Days = batchLogs.filter(l => l.log_date !== today)
    if (todayMortality && prior3Days.length >= 1) {
      const rollingAvg = prior3Days.reduce((s, l) => s + Number(l.mortality_count), 0) / prior3Days.length
      const todayCount = Number(todayMortality.mortality_count)
      if (rollingAvg > 0 && todayCount > rollingAvg * 2) {
        alerts.push({
          id: `mortality-spike-${batch.id}`,
          type: 'mortality_spike',
          severity: 'critical',
          shedName,
          batchId: batch.id,
          shedId: batch.shed_id,
          title: `Mortality spike — ${shedName}`,
          detail: `Today: ${todayCount} deaths vs. ${rollingAvg.toFixed(1)} rolling avg (${(todayCount / rollingAvg).toFixed(1)}×). Investigate immediately.`,
          actionLabel: 'View Growth & Logs',
          actionHref: `/sheds/${batch.shed_id}/batches/${batch.id}/growth`,
          triggeredAt: now,
        })
      }
    }

    // ── 3. Cumulative mortality > 5% ─────────────────────────────────────────
    const totalMortality = allBatchLogs.reduce((s, l) => s + Number(l.mortality_count), 0)
    const mortalityPct = (totalMortality / batch.starting_bird_count) * 100
    if (mortalityPct >= 5) {
      alerts.push({
        id: `high-mortality-${batch.id}`,
        type: 'high_mortality_cumulative',
        severity: mortalityPct >= 8 ? 'critical' : 'warning',
        shedName,
        batchId: batch.id,
        shedId: batch.shed_id,
        title: `High cumulative mortality — ${shedName}`,
        detail: `${totalMortality.toLocaleString()} deaths (${mortalityPct.toFixed(1)}% of flock). Industry benchmark is <5%.`,
        actionLabel: 'View Batch',
        actionHref: `/sheds/${batch.shed_id}/batches/${batch.id}`,
        triggeredAt: now,
      })
    }

    // ── 4. Low feed stock ─────────────────────────────────────────────────────
    if (todayLog && todayLog.feed_stock_remaining_kg !== null) {
      const stockKg = Number(todayLog.feed_stock_remaining_kg)
      // Estimate daily avg feed from last 3 days
      const last3FeedLogs = batchLogs.filter(l => l.log_date !== today).slice(0, 3)
      if (last3FeedLogs.length > 0) {
        const avgDailyFeed = last3FeedLogs.reduce((s, l) => s + Number(l.feed_given_kg), 0) / last3FeedLogs.length
        if (avgDailyFeed > 0) {
          const daysLeft = stockKg / avgDailyFeed
          if (daysLeft <= 2) {
            alerts.push({
              id: `low-feed-${batch.id}`,
              type: 'low_feed_stock',
              severity: daysLeft < 1 ? 'critical' : 'warning',
              shedName,
              batchId: batch.id,
              shedId: batch.shed_id,
              title: `Low feed stock — ${shedName}`,
              detail: `${stockKg.toLocaleString()} kg remaining ≈ ${daysLeft.toFixed(1)} day${daysLeft < 2 ? '' : 's'} supply at current usage (${avgDailyFeed.toFixed(0)} kg/day avg).`,
              actionLabel: 'Log Feed Purchase',
              actionHref: `/sheds/${batch.shed_id}/batches/${batch.id}/expenses/new`,
              triggeredAt: now,
            })
          }
        }
      }
    }
  }

  // Sort: critical first, then warning, then info; within each group keep order
  const severityOrder: Record<AlertSeverity, number> = { critical: 0, warning: 1, info: 2 }
  alerts.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity])

  const criticalCount = alerts.filter(a => a.severity === 'critical').length
  const warningCount  = alerts.filter(a => a.severity === 'warning').length

  return (
    <div className="container" style={{ paddingTop: '16px', paddingBottom: '40px' }}>

      {/* Header */}
      <div style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1 style={{ fontSize: '1.375rem', fontWeight: 800, marginBottom: '4px' }}>Alerts</h1>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
              {alerts.length === 0
                ? 'All clear — no issues detected'
                : `${criticalCount > 0 ? `${criticalCount} critical` : ''}${criticalCount > 0 && warningCount > 0 ? ', ' : ''}${warningCount > 0 ? `${warningCount} warning${warningCount !== 1 ? 's' : ''}` : ''}`}
            </p>
          </div>
          {alerts.length > 0 && (
            <div style={{
              background: criticalCount > 0 ? 'var(--red-400)' : 'var(--amber-400)',
              color: '#fff',
              fontWeight: 800,
              fontSize: '0.875rem',
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}>
              {alerts.length}
            </div>
          )}
        </div>
      </div>

      {/* Alert rules legend */}
      <div style={{
        marginBottom: '20px',
        padding: '12px 14px',
        background: 'var(--bg-card)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-md)',
        fontSize: '0.8125rem',
        color: 'var(--text-muted)',
      }}>
        <div style={{ fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '6px', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Alert Rules
        </div>
        <div className="stack" style={{ gap: '4px' }}>
          <span>🔴 <strong>Mortality spike</strong> — today&apos;s deaths &gt; 2× the 3-day rolling avg</span>
          <span>🔴 <strong>Critical mortality</strong> — cumulative deaths ≥ 8% of flock</span>
          <span>🟡 <strong>High mortality</strong> — cumulative deaths 5–8% of flock</span>
          <span>🟡 <strong>Low feed stock</strong> — &lt;2 days of supply remaining at current rate</span>
          <span>🟡 <strong>Missing log</strong> — active shed has no entry for today</span>
        </div>
      </div>

      {/* Alert list */}
      {alerts.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state__icon">✅</div>
          <div className="empty-state__title">All clear</div>
          <div className="empty-state__desc">
            No mortality spikes, feed issues, or missing logs detected across {activeBatches.length} active batch{activeBatches.length !== 1 ? 'es' : ''}.
          </div>
        </div>
      ) : (
        <div className="stack stack--sm">
          {alerts.map(alert => {
            const cfg = severityConfig(alert.severity)
            return (
              <div
                key={alert.id}
                style={{
                  background: cfg.bg,
                  border: `1px solid ${cfg.border}`,
                  borderRadius: 'var(--radius-md)',
                  padding: '16px',
                }}
              >
                {/* Alert header */}
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', marginBottom: '10px' }}>
                  <span style={{ fontSize: '1.25rem', lineHeight: 1, flexShrink: 0 }}>{cfg.icon}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: '0.9375rem', color: 'var(--text-primary)', lineHeight: 1.3 }}>
                      {alert.title}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                      {cfg.label} · {alert.shedName} · {formatTime(alert.triggeredAt)}
                    </div>
                  </div>
                </div>

                {/* Detail */}
                <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '14px', lineHeight: 1.5 }}>
                  {alert.detail}
                </p>

                {/* Action */}
                <Link
                  href={alert.actionHref}
                  id={`alert-action-${alert.id}`}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '0.875rem',
                    fontWeight: 700,
                    color: cfg.color,
                    textDecoration: 'none',
                    padding: '8px 14px',
                    borderRadius: 'var(--radius-sm)',
                    border: `1px solid ${cfg.border}`,
                    background: 'var(--bg-elevated)',
                    transition: 'all var(--transition)',
                  }}
                >
                  {alert.actionLabel} →
                </Link>
              </div>
            )
          })}
        </div>
      )}

      {/* Explanation footer */}
      {alerts.length > 0 && (
        <p style={{ marginTop: '24px', fontSize: '0.8125rem', color: 'var(--text-muted)', textAlign: 'center', lineHeight: 1.6 }}>
          Alerts are computed live from your batch data each time this page loads.<br />
          WhatsApp / SMS delivery will be added in a future update.
        </p>
      )}
    </div>
  )
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function NoAlertsState({ reason }: { reason: string }) {
  return (
    <div className="container" style={{ paddingTop: '32px' }}>
      <div className="empty-state">
        <div className="empty-state__icon">🔔</div>
        <div className="empty-state__title">No alerts</div>
        <div className="empty-state__desc">{reason} Alerts will appear here once you have active batches.</div>
      </div>
    </div>
  )
}
