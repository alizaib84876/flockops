import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { redirect } from 'next/navigation'

export const metadata = {
  title: 'Dashboard — FlockOps',
  description: 'Real-time overview of all broiler sheds, active batches, and key performance indicators.',
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface RawShed {
  id: string
  name: string
  capacity: number
  location: string | null
}

interface RawBatch {
  id: string
  shed_id: string
  breed: string
  placement_date: string
  starting_bird_count: number
  status: string
}

interface RawLog {
  batch_id: string
  log_date: string
  mortality_count: number
  feed_given_kg: number
  water_given_liters: number | null
}

interface RawSale {
  batch_id: string
  total_amount: number
}

interface RawExpense {
  batch_id: string
  amount: number
}

interface RawWeightSample {
  batch_id: string
  avg_weight_g: number
  sample_date: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getDayOfCycle(placementDate: string): number {
  const diff = Math.floor((Date.now() - new Date(placementDate).getTime()) / 86400000)
  return Math.max(1, diff + 1)
}

function getGreeting(): string {
  const h = new Date().getHours()
  if (h < 12) return 'morning'
  if (h < 17) return 'afternoon'
  return 'evening'
}

function todayStr(): string {
  return new Date().toISOString().split('T')[0]
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function DashboardPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Farm
  const { data: userData } = await supabase
    .from('users')
    .select('farm_id')
    .eq('id', user.id)
    .single()
  const farmId = (userData as { farm_id: string | null } | null)?.farm_id

  if (!farmId) {
    return <OnboardingPrompt />
  }

  // Fetch everything in parallel
  const [shedsRes, batchesRes, logsRes, salesRes, expensesRes, weightRes] = await Promise.all([
    supabase.from('sheds').select('id, name, capacity, location').eq('farm_id', farmId).order('name'),
    supabase.from('batches').select('id, shed_id, breed, placement_date, starting_bird_count, status').eq('farm_id', farmId).eq('status', 'active'),
    // All logs for active batches (we'll filter by batch_id client-side)
    supabase.from('daily_logs').select('batch_id, log_date, mortality_count, feed_given_kg, water_given_liters').order('log_date', { ascending: false }),
    supabase.from('sales').select('batch_id, total_amount'),
    supabase.from('expenses').select('batch_id, amount'),
    supabase.from('weight_samples').select('batch_id, avg_weight_g, sample_date').order('sample_date', { ascending: false }),
  ])

  const allSheds: RawShed[] = shedsRes.data ?? []
  const activeBatches: RawBatch[] = batchesRes.data ?? []
  const allLogs: RawLog[] = logsRes.data ?? []
  const allSales: RawSale[] = salesRes.data ?? []
  const allExpenses: RawExpense[] = expensesRes.data ?? []
  const allWeights: RawWeightSample[] = weightRes.data ?? []

  const activeBatchIds = new Set(activeBatches.map(b => b.id))
  const today = todayStr()

  // ── Build per-shed data ──────────────────────────────────────────────────────
  interface ShedCard {
    shed: RawShed
    batch: RawBatch | null
    dayOfCycle: number | null
    liveBirds: number | null
    totalMortality: number
    mortalityPct: string
    todayFeedKg: number | null
    totalFeedKg: number
    fcr: number | null
    latestWeightG: number | null
    totalRevenue: number
    totalExpenses: number
    loggedToday: boolean
  }

  const CHICK_WEIGHT_G = 42

  const shedCards: ShedCard[] = allSheds.map(shed => {
    const batch = activeBatches.find(b => b.shed_id === shed.id) ?? null

    if (!batch) {
      return {
        shed, batch: null, dayOfCycle: null, liveBirds: null,
        totalMortality: 0, mortalityPct: '0.00', todayFeedKg: null,
        totalFeedKg: 0, fcr: null, latestWeightG: null,
        totalRevenue: 0, totalExpenses: 0, loggedToday: false,
      }
    }

    const batchLogs = allLogs.filter(l => l.batch_id === batch.id)
    const totalMortality = batchLogs.reduce((s, l) => s + Number(l.mortality_count), 0)
    const totalFeedKg = batchLogs.reduce((s, l) => s + Number(l.feed_given_kg), 0)
    const liveBirds = batch.starting_bird_count - totalMortality
    const mortalityPct = ((totalMortality / batch.starting_bird_count) * 100).toFixed(2)

    const todayLog = batchLogs.find(l => l.log_date === today)
    const todayFeedKg = todayLog ? Number(todayLog.feed_given_kg) : null
    const loggedToday = !!todayLog

    // Latest weight sample
    const latestWeight = allWeights.find(w => w.batch_id === batch.id)
    const latestWeightG = latestWeight ? Number(latestWeight.avg_weight_g) : null

    // FCR
    let fcr: number | null = null
    if (latestWeightG && totalFeedKg > 0) {
      const gainKg = (latestWeightG - CHICK_WEIGHT_G) / 1000 * liveBirds
      if (gainKg > 0) fcr = totalFeedKg / gainKg
    }

    // Revenue & expenses
    const totalRevenue = allSales
      .filter(s => s.batch_id === batch.id)
      .reduce((s, r) => s + Number(r.total_amount), 0)
    const totalExpenses = allExpenses
      .filter(e => e.batch_id === batch.id)
      .reduce((s, r) => s + Number(r.amount), 0)

    return {
      shed, batch, dayOfCycle: getDayOfCycle(batch.placement_date),
      liveBirds, totalMortality, mortalityPct,
      todayFeedKg, totalFeedKg, fcr, latestWeightG,
      totalRevenue, totalExpenses, loggedToday,
    }
  })

  // ── Farm-level summary ───────────────────────────────────────────────────────
  const activeCount = shedCards.filter(c => c.batch !== null).length
  const totalLiveBirds = shedCards.reduce((s, c) => s + (c.liveBirds ?? 0), 0)
  const todayTotalMortality = allLogs
    .filter(l => l.log_date === today && activeBatchIds.has(l.batch_id))
    .reduce((s, l) => s + Number(l.mortality_count), 0)
  const logsCompleteToday = shedCards.filter(c => c.batch && c.loggedToday).length
  const needsLogToday = shedCards.filter(c => c.batch && !c.loggedToday).length

  // ── FCR quality label ────────────────────────────────────────────────────────
  function fcrLabel(f: number): { text: string; color: string } {
    if (f < 1.6) return { text: 'Excellent', color: 'var(--green-400)' }
    if (f < 1.8) return { text: 'Good', color: 'var(--green-400)' }
    if (f < 2.0) return { text: 'Average', color: 'var(--amber-400)' }
    return { text: 'Poor', color: 'var(--red-400)' }
  }

  return (
    <div className="container" style={{ paddingTop: '16px', paddingBottom: '32px' }}>

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1 style={{ fontSize: '1.375rem', fontWeight: 800, marginBottom: '2px' }}>
              Good {getGreeting()} 👋
            </h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
              {activeCount > 0
                ? `${activeCount} active batch${activeCount !== 1 ? 'es' : ''} · ${totalLiveBirds.toLocaleString()} live birds`
                : 'No active batches running'}
            </p>
          </div>
          <Link
            href="/sheds"
            className="btn btn--ghost btn--sm"
            id="btn-manage-sheds"
            style={{ width: 'auto', flexShrink: 0 }}
          >
            Manage Sheds
          </Link>
        </div>
      </div>

      {/* ── Farm-level summary strip ─────────────────────────────────────────── */}
      {activeCount > 0 && (
        <div style={{ marginBottom: '20px' }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: '8px',
          }}>
            <div style={summaryTile}>
              <div style={summaryLabel}>Active Sheds</div>
              <div style={{ ...summaryValue, color: 'var(--accent)' }}>{activeCount}/{allSheds.length}</div>
            </div>
            <div style={summaryTile}>
              <div style={summaryLabel}>Live Birds</div>
              <div style={summaryValue}>{totalLiveBirds.toLocaleString()}</div>
            </div>
            <div style={{ ...summaryTile, background: todayTotalMortality > 0 ? 'rgba(239,68,68,0.06)' : 'var(--bg-card)' }}>
              <div style={summaryLabel}>Mortality Today</div>
              <div style={{ ...summaryValue, color: todayTotalMortality > 0 ? 'var(--red-400)' : 'var(--text-muted)' }}>
                {todayTotalMortality}
              </div>
            </div>
            <div style={{ ...summaryTile, background: needsLogToday > 0 ? 'rgba(245,158,11,0.06)' : 'var(--bg-card)' }}>
              <div style={summaryLabel}>Logs Today</div>
              <div style={{ ...summaryValue, color: needsLogToday > 0 ? 'var(--amber-400)' : 'var(--green-400)' }}>
                {logsCompleteToday}/{activeCount}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Pending logs alert ───────────────────────────────────────────────── */}
      {needsLogToday > 0 && (
        <div className="alert-banner alert-banner--warn" style={{ marginBottom: '16px' }}>
          <span>⚠️</span>
          <span style={{ fontSize: '0.875rem' }}>
            <strong>{needsLogToday} shed{needsLogToday !== 1 ? 's' : ''}</strong> still need{needsLogToday === 1 ? 's' : ''} today&apos;s log entered
          </span>
        </div>
      )}

      {/* ── Shed cards ──────────────────────────────────────────────────────── */}
      <div style={{ marginBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <p className="section-title" style={{ margin: 0 }}>All Sheds</p>
        <Link href="/sheds/new" className="btn btn--ghost btn--sm" id="btn-add-shed-dash" style={{ width: 'auto' }}>
          + Add Shed
        </Link>
      </div>

      {allSheds.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state__icon">🏚️</div>
          <div className="empty-state__title">No sheds yet</div>
          <div className="empty-state__desc">Add your broiler sheds to start tracking.</div>
          <Link href="/sheds/new" className="btn btn--primary" style={{ marginTop: '8px' }} id="btn-add-first-shed">
            Add First Shed
          </Link>
        </div>
      ) : (
        <div className="stack stack--sm">
          {shedCards.map(card => (
            <ShedCard key={card.shed.id} card={card} fcrLabel={fcrLabel} />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Shed Card ────────────────────────────────────────────────────────────────

interface ShedCardProps {
  card: {
    shed: RawShed
    batch: RawBatch | null
    dayOfCycle: number | null
    liveBirds: number | null
    totalMortality: number
    mortalityPct: string
    todayFeedKg: number | null
    totalFeedKg: number
    fcr: number | null
    latestWeightG: number | null
    totalRevenue: number
    totalExpenses: number
    loggedToday: boolean
  }
  fcrLabel: (f: number) => { text: string; color: string }
}

function ShedCard({ card, fcrLabel }: ShedCardProps) {
  const { shed, batch, dayOfCycle, liveBirds, totalMortality, mortalityPct,
    todayFeedKg, fcr, latestWeightG, loggedToday } = card

  const hasHighMortality = parseFloat(mortalityPct) > 3

  if (!batch) {
    // Idle shed
    return (
      <Link
        href={`/sheds/${shed.id}`}
        className="card"
        id={`shed-card-${shed.id}`}
        style={{ display: 'block', textDecoration: 'none', padding: '16px', opacity: 0.7 }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '40px', height: '40px', borderRadius: 'var(--radius-md)',
              background: 'var(--bg-elevated)', display: 'flex', alignItems: 'center',
              justifyContent: 'center', fontSize: '1.25rem', flexShrink: 0,
            }}>🏚️</div>
            <div>
              <div style={{ fontWeight: 700, fontSize: '1rem' }}>{shed.name}</div>
              <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                {shed.capacity.toLocaleString()} bird capacity · No active batch
              </div>
            </div>
          </div>
          <span className="badge badge--closed">Idle</span>
        </div>
      </Link>
    )
  }

  // Active shed
  return (
    <div
      className="card"
      id={`shed-card-${shed.id}`}
      style={{
        padding: '16px',
        borderColor: hasHighMortality ? 'rgba(239,68,68,0.3)' : !loggedToday ? 'rgba(245,158,11,0.3)' : 'var(--border)',
      }}
    >
      {/* Card header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
        <Link href={`/sheds/${shed.id}`} style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '10px', flex: 1 }}>
          <div style={{
            width: '40px', height: '40px', borderRadius: 'var(--radius-md)',
            background: 'var(--accent-dim)', display: 'flex', alignItems: 'center',
            justifyContent: 'center', fontSize: '1.25rem', flexShrink: 0,
          }}>🏠</div>
          <div>
            <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)' }}>{shed.name}</div>
            <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: '1px' }}>
              {batch.breed} · Day {dayOfCycle}
            </div>
          </div>
        </Link>
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexShrink: 0 }}>
          {!loggedToday && (
            <Link
              href={`/sheds/${shed.id}/batches/${batch.id}/log`}
              className="btn btn--primary btn--sm"
              id={`btn-log-today-${shed.id}`}
              style={{ width: 'auto', fontSize: '0.8125rem' }}
            >
              Log Today
            </Link>
          )}
          {loggedToday && (
            <span style={{
              fontSize: '0.75rem', fontWeight: 700, color: 'var(--green-400)',
              background: 'rgba(34,197,94,0.08)', padding: '4px 8px',
              borderRadius: '20px', border: '1px solid rgba(34,197,94,0.2)',
            }}>
              ✓ Logged
            </span>
          )}
        </div>
      </div>

      {/* Metrics row */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: '8px',
      }}>
        <MetricCell
          label="Live Birds"
          value={liveBirds?.toLocaleString() ?? '—'}
          sub={`${totalMortality} deaths`}
          warn={hasHighMortality}
        />
        <MetricCell
          label="Mortality"
          value={`${mortalityPct}%`}
          sub={`${totalMortality} total`}
          warn={hasHighMortality}
        />
        <MetricCell
          label={todayFeedKg !== null ? "Feed Today" : "Total Feed"}
          value={`${todayFeedKg !== null ? todayFeedKg.toFixed(0) : card.totalFeedKg.toFixed(0)}`}
          sub="kg"
        />
        {fcr !== null ? (
          <MetricCell
            label="FCR"
            value={fcr.toFixed(2)}
            sub={fcrLabel(fcr).text}
            valueColor={fcrLabel(fcr).color}
          />
        ) : latestWeightG !== null ? (
          <MetricCell
            label="Weight"
            value={`${latestWeightG.toLocaleString()}g`}
            sub="latest sample"
          />
        ) : (
          <MetricCell label="Weight" value="—" sub="no sample yet" />
        )}
      </div>

      {/* Quick action row */}
      <div style={{
        marginTop: '12px',
        paddingTop: '12px',
        borderTop: '1px solid var(--border-subtle)',
        display: 'flex',
        gap: '6px',
        flexWrap: 'wrap',
      }}>
        <QuickLink href={`/sheds/${shed.id}/batches/${batch.id}`} id={`ql-batch-${shed.id}`}>Batch</QuickLink>
        <QuickLink href={`/sheds/${shed.id}/batches/${batch.id}/growth`} id={`ql-growth-${shed.id}`}>Growth</QuickLink>
        <QuickLink href={`/sheds/${shed.id}/batches/${batch.id}/financials`} id={`ql-fin-${shed.id}`}>Financials</QuickLink>
        <QuickLink href={`/sheds/${shed.id}/batches/${batch.id}/sales`} id={`ql-sales-${shed.id}`}>Sales</QuickLink>
      </div>
    </div>
  )
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function MetricCell({
  label, value, sub, warn, valueColor,
}: {
  label: string
  value: string
  sub: string
  warn?: boolean
  valueColor?: string
}) {
  return (
    <div style={{
      background: warn ? 'rgba(239,68,68,0.05)' : 'var(--bg-elevated)',
      borderRadius: 'var(--radius-sm)',
      padding: '8px 10px',
    }}>
      <div style={{ fontSize: '0.625rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: '3px' }}>
        {label}
      </div>
      <div style={{ fontWeight: 800, fontSize: '0.9375rem', color: warn ? 'var(--red-400)' : valueColor ?? 'var(--text-primary)', lineHeight: 1.2 }}>
        {value}
      </div>
      <div style={{ fontSize: '0.625rem', color: 'var(--text-muted)', marginTop: '2px' }}>{sub}</div>
    </div>
  )
}

function QuickLink({ href, id, children }: { href: string; id: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      id={id}
      style={{
        fontSize: '0.8125rem',
        fontWeight: 600,
        color: 'var(--text-muted)',
        background: 'var(--bg-elevated)',
        padding: '5px 10px',
        borderRadius: '20px',
        border: '1px solid var(--border)',
        textDecoration: 'none',
        transition: 'all var(--transition)',
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </Link>
  )
}

function OnboardingPrompt() {
  return (
    <div className="container" style={{ paddingTop: '32px' }}>
      <div className="card" style={{ textAlign: 'center', padding: '40px 24px' }}>
        <div style={{ fontSize: '3.5rem', marginBottom: '16px' }}>🐔</div>
        <h1 style={{ fontSize: '1.375rem', marginBottom: '8px' }}>Welcome to FlockOps</h1>
        <p style={{ color: 'var(--text-muted)', marginBottom: '28px', fontSize: '0.9375rem', maxWidth: '300px', margin: '0 auto 28px' }}>
          Set up your farm profile first, then add your sheds and start tracking.
        </p>
        <Link href="/settings/farm/new" className="btn btn--primary" id="btn-create-farm" style={{ display: 'inline-flex', width: 'auto', padding: '14px 28px' }}>
          Set Up My Farm
        </Link>
      </div>
    </div>
  )
}

// ─── Inline style tokens ──────────────────────────────────────────────────────

const summaryTile: React.CSSProperties = {
  background: 'var(--bg-card)',
  border: '1px solid var(--border-subtle)',
  borderRadius: 'var(--radius-md)',
  padding: '10px 12px',
  textAlign: 'center',
}

const summaryLabel: React.CSSProperties = {
  fontSize: '0.625rem',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  color: 'var(--text-muted)',
  marginBottom: '4px',
}

const summaryValue: React.CSSProperties = {
  fontWeight: 800,
  fontSize: '1.25rem',
  color: 'var(--text-primary)',
  lineHeight: 1,
}
