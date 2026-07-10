import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'

interface Props {
  params: Promise<{ shedId: string; batchId: string }>
}

export async function generateMetadata({ params }: Props) {
  const { batchId } = await params
  const supabase = await createClient()
  const { data } = await supabase.from('batches').select('breed').eq('id', batchId).single()
  return { title: `${data?.breed ?? 'Batch'} — FlockOps` }
}

export default async function BatchDetailPage({ params }: Props) {
  const { shedId, batchId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: batch } = await supabase
    .from('batches')
    .select('id, breed, placement_date, starting_bird_count, target_harvest_weight, status, created_at, shed_id')
    .eq('id', batchId)
    .eq('shed_id', shedId)
    .single()

  if (!batch) notFound()

  const { data: shed } = await supabase
    .from('sheds')
    .select('name')
    .eq('id', shedId)
    .single()

  // Fetch daily logs for this batch
  const { data: logs } = await supabase
    .from('daily_logs')
    .select('id, log_date, mortality_count, feed_given_kg, feed_stock_remaining_kg, temperature_c, humidity_pct')
    .eq('batch_id', batchId)
    .order('log_date', { ascending: false })

  const allLogs = logs ?? []
  const totalMortality = allLogs.reduce((sum, l) => sum + l.mortality_count, 0)
  const totalFeed = allLogs.reduce((sum, l) => sum + Number(l.feed_given_kg), 0)
  const mortalityPct = batch.starting_bird_count > 0
    ? ((totalMortality / batch.starting_bird_count) * 100).toFixed(2)
    : '0.00'
  const dayOfCycle = getDayOfCycle(batch.placement_date)
  const daysRemaining = Math.max(0, 40 - dayOfCycle) // default 40-day cycle if no target

  // Fetch latest weight sample for FCR
  const { data: latestWeight } = await supabase
    .from('weight_samples')
    .select('avg_weight_g, sample_date')
    .eq('batch_id', batchId)
    .order('sample_date', { ascending: false })
    .limit(1)
    .maybeSingle()

  // FCR = total feed / total weight gained
  const CHICK_WEIGHT_G = 42
  const liveBirds = batch.starting_bird_count - totalMortality
  let fcr: number | null = null
  if (latestWeight && totalFeed > 0) {
    const gainKg = (Number(latestWeight.avg_weight_g) - CHICK_WEIGHT_G) / 1000 * liveBirds
    if (gainKg > 0) fcr = totalFeed / gainKg
  }

  function getDayOfCycle(pd: string): number {
    const placed = new Date(pd)
    const today = new Date()
    return Math.max(0, Math.floor((today.getTime() - placed.getTime()) / (1000 * 60 * 60 * 24))) + 1
  }

  function formatDate(d: string) {
    return new Date(d).toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' })
  }

  const isActive = batch.status === 'active'

  return (
    <div className="container" style={{ paddingTop: '16px', paddingBottom: '32px' }}>
      {/* Header */}
      <div className="page-header" style={{ padding: '0 0 20px 0' }}>
        <Link href={`/sheds/${shedId}`} className="page-header__back" id="btn-back-shed">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </Link>
        <div className="page-header__info">
          <h1 className="page-header__title">{batch.breed}</h1>
          <p className="page-header__subtitle">{shed?.name} · {formatDate(batch.placement_date)}</p>
        </div>
        <span className={`badge badge--${batch.status}`}>{batch.status}</span>
      </div>

      {/* Stats */}
      <div style={{ marginBottom: '24px' }}>
        <div className="stat-grid">
          <div className="stat-card stat-card--accent">
            <div className="stat-card__label">Day of Cycle</div>
            <div className="stat-card__value">{dayOfCycle}</div>
            <div className="stat-card__sub">{daysRemaining} days left</div>
          </div>
          <div className="stat-card">
            <div className="stat-card__label">Birds Placed</div>
            <div className="stat-card__value">{batch.starting_bird_count.toLocaleString()}</div>
          </div>
          <div className={`stat-card ${parseFloat(mortalityPct) > 3 ? 'stat-card--danger' : ''}`}>
            <div className="stat-card__label">Total Mortality</div>
            <div className="stat-card__value">{totalMortality.toLocaleString()}</div>
            <div className="stat-card__sub">{mortalityPct}%</div>
          </div>
          <div className="stat-card">
            <div className="stat-card__label">Total Feed</div>
            <div className="stat-card__value">{totalFeed.toFixed(0)}</div>
            <div className="stat-card__sub">kg consumed</div>
          </div>
          {/* FCR stat */}
          <div className="stat-card" style={{ borderColor: fcr !== null && fcr < 1.8 ? 'rgba(34,197,94,0.25)' : fcr !== null && fcr > 2.0 ? 'rgba(239,68,68,0.25)' : undefined }}>
            <div className="stat-card__label">FCR</div>
            <div className="stat-card__value" style={{ color: fcr === null ? 'var(--text-muted)' : fcr < 1.8 ? 'var(--green-400)' : fcr > 2.0 ? 'var(--red-400)' : 'var(--amber-400)' }}>
              {fcr !== null ? fcr.toFixed(2) : '—'}
            </div>
            <div className="stat-card__sub">{fcr !== null ? (fcr < 1.6 ? 'Excellent' : fcr < 1.8 ? 'Good' : fcr < 2.0 ? 'Average' : 'Poor') : 'No weight data'}</div>
          </div>
          <div className="stat-card">
            <div className="stat-card__label">Live Birds</div>
            <div className="stat-card__value">{liveBirds.toLocaleString()}</div>
            <div className="stat-card__sub">est. current</div>
          </div>
        </div>
      </div>

      {/* Actions */}
      {isActive && (
        <div className="stack stack--sm" style={{ marginBottom: '24px' }}>
          <Link
            href={`/sheds/${shedId}/batches/${batchId}/log`}
            className="btn btn--primary"
            id="btn-enter-daily-log"
          >
            📋 Enter Today&apos;s Log
          </Link>
          <Link
            href={`/sheds/${shedId}/batches/${batchId}/growth`}
            className="btn btn--secondary"
            id="btn-view-growth"
          >
            📈 Growth & FCR
          </Link>
          <Link
            href={`/sheds/${shedId}/batches/${batchId}/close`}
            className="btn btn--secondary"
            id="btn-close-batch"
          >
            🏁 Close / Harvest Batch
          </Link>
        </div>
      )}

      {/* Recent Daily Logs */}
      <div>
        <p className="section-title">Daily Logs ({allLogs.length})</p>
        {allLogs.length === 0 ? (
          <div className="empty-state" style={{ padding: '32px 16px' }}>
            <div className="empty-state__icon">📝</div>
            <div className="empty-state__title">No logs yet</div>
            <div className="empty-state__desc">Enter the first daily log for this batch.</div>
            {isActive && (
              <Link
                href={`/sheds/${shedId}/batches/${batchId}/log`}
                className="btn btn--primary"
                style={{ marginTop: '8px' }}
                id="btn-first-log"
              >
                Enter First Log
              </Link>
            )}
          </div>
        ) : (
          <div className="stack stack--sm">
            {allLogs.slice(0, 10).map(log => (
              <div key={log.id} className="card" style={{ padding: '14px 16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontWeight: 600, fontSize: '0.9375rem' }}>
                    {formatDate(log.log_date)}
                  </span>
                  <span style={{ color: log.mortality_count > 0 ? 'var(--red-400)' : 'var(--green-400)', fontSize: '0.875rem', fontWeight: 600 }}>
                    {log.mortality_count > 0 ? `−${log.mortality_count} mortality` : '0 mortality'}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '16px', fontSize: '0.8125rem', color: 'var(--text-muted)', flexWrap: 'wrap' }}>
                  <span>Feed: <strong style={{ color: 'var(--text-secondary)' }}>{log.feed_given_kg} kg</strong></span>
                  <span>Stock: <strong style={{ color: 'var(--text-secondary)' }}>{log.feed_stock_remaining_kg} kg</strong></span>
                  {log.temperature_c != null && <span>Temp: <strong style={{ color: 'var(--text-secondary)' }}>{log.temperature_c}°C</strong></span>}
                  {log.humidity_pct != null && <span>Humidity: <strong style={{ color: 'var(--text-secondary)' }}>{log.humidity_pct}%</strong></span>}
                </div>
              </div>
            ))}
            {allLogs.length > 10 && (
              <p style={{ textAlign: 'center', fontSize: '0.875rem', color: 'var(--text-muted)', padding: '8px' }}>
                Showing 10 of {allLogs.length} logs
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
