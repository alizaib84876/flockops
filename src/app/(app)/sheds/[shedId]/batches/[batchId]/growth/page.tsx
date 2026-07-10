import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import GrowthChartClient from '@/components/GrowthChartClient'
import { getStandardWeight, BREEDS_WITH_STANDARDS } from '@/lib/breedStandards'

interface Props {
  params: Promise<{ shedId: string; batchId: string }>
}

export async function generateMetadata({ params }: Props) {
  const { batchId } = await params
  const supabase = await createClient()
  const { data } = await supabase.from('batches').select('breed').eq('id', batchId).single()
  return { title: `Growth & FCR — ${data?.breed ?? 'Batch'} — FlockOps` }
}

export default async function GrowthPage({ params }: Props) {
  const { shedId, batchId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Batch info
  const { data: batch } = await supabase
    .from('batches')
    .select('id, breed, placement_date, starting_bird_count, status, shed_id')
    .eq('id', batchId)
    .eq('shed_id', shedId)
    .single()

  if (!batch) notFound()

  const { data: shed } = await supabase
    .from('sheds')
    .select('name')
    .eq('id', shedId)
    .single()

  // Weight samples
  const { data: samples } = await supabase
    .from('weight_samples')
    .select('id, sample_date, sample_size, avg_weight_g')
    .eq('batch_id', batchId)
    .order('sample_date', { ascending: true })

  const allSamples = samples ?? []

  // Daily logs for cumulative feed + mortality
  const { data: logs } = await supabase
    .from('daily_logs')
    .select('mortality_count, feed_given_kg, log_date')
    .eq('batch_id', batchId)
    .order('log_date', { ascending: true })

  const allLogs = logs ?? []
  const totalMortality = allLogs.reduce((s, l) => s + Number(l.mortality_count), 0)
  const totalFeedKg = allLogs.reduce((s, l) => s + Number(l.feed_given_kg), 0)
  const liveBirds = batch.starting_bird_count - totalMortality

  // Day of cycle — 1-based (Day 1 = placement day, same as dayOfCycle)
  const placementMs = new Date(batch.placement_date).getTime()
  function dayForDate(dateStr: string): number {
    // Day 1 = placement day, Day 2 = next day, etc.
    return Math.max(1, Math.floor((new Date(dateStr).getTime() - placementMs) / (1000 * 60 * 60 * 24)) + 1)
  }
  const dayOfCycle = Math.max(1, Math.floor((Date.now() - placementMs) / (1000 * 60 * 60 * 24)) + 1)


  // Latest weight sample
  const latestSample = allSamples[allSamples.length - 1]

  // FCR calculation
  // FCR = cumulative feed (kg) / total weight gained (kg)
  // Total weight gained = (avg_weight_g - 42g chick weight) / 1000 * live_birds
  const CHICK_WEIGHT_G = 42
  let fcr: number | null = null
  let totalWeightGainedKg: number | null = null

  if (latestSample && totalFeedKg > 0) {
    const gainPerBird = (Number(latestSample.avg_weight_g) - CHICK_WEIGHT_G) / 1000
    totalWeightGainedKg = gainPerBird * liveBirds
    if (totalWeightGainedKg > 0) {
      fcr = totalFeedKg / totalWeightGainedKg
    }
  }

  // Build chart data — map samples to day-of-cycle
  const chartSamples = allSamples.map(s => ({
    day: dayForDate(s.sample_date),
    avgWeightG: Number(s.avg_weight_g),
  }))

  const hasStandard = BREEDS_WITH_STANDARDS.includes(batch.breed as never)

  // FCR quality rating
  function fcrRating(f: number): { label: string; color: string } {
    if (f < 1.6) return { label: 'Excellent', color: 'var(--green-400)' }
    if (f < 1.8) return { label: 'Good', color: 'var(--green-400)' }
    if (f < 2.0) return { label: 'Average', color: 'var(--amber-400)' }
    return { label: 'Poor', color: 'var(--red-400)' }
  }

  // Standard weight for today
  const stdToday = getStandardWeight(batch.breed, dayOfCycle)
  const actualLatest = latestSample ? Number(latestSample.avg_weight_g) : null
  const vsStandard = stdToday && actualLatest ? actualLatest - stdToday : null

  function formatDate(d: string) {
    return new Date(d).toLocaleDateString('en-PK', { day: 'numeric', month: 'short' })
  }

  return (
    <div className="container" style={{ paddingTop: '16px', paddingBottom: '40px' }}>
      {/* Header */}
      <div className="page-header" style={{ padding: '0 0 20px 0' }}>
        <Link href={`/sheds/${shedId}/batches/${batchId}`} className="page-header__back" id="btn-back-batch">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </Link>
        <div className="page-header__info">
          <h1 className="page-header__title">Growth & FCR</h1>
          <p className="page-header__subtitle">{shed?.name} · {batch.breed} · Day {dayOfCycle}</p>
        </div>
        <Link
          href={`/sheds/${shedId}/batches/${batchId}/weights/new`}
          className="btn btn--primary btn--sm"
          id="btn-add-weight"
          style={{ width: 'auto', flexShrink: 0 }}
        >
          + Sample
        </Link>
      </div>

      {/* Key metrics */}
      <div style={{ marginBottom: '20px' }}>
        <div className="stat-grid">
          {/* FCR */}
          <div className="stat-card" style={{
            gridColumn: fcr !== null ? '1' : '1 / -1',
            borderColor: fcr ? (fcrRating(fcr).color === 'var(--green-400)' ? 'rgba(34,197,94,0.25)' : 'rgba(239,68,68,0.25)') : undefined,
          }}>
            <div className="stat-card__label">FCR</div>
            <div className="stat-card__value" style={{ color: fcr ? fcrRating(fcr).color : 'var(--text-muted)' }}>
              {fcr !== null ? fcr.toFixed(2) : '—'}
            </div>
            <div className="stat-card__sub">
              {fcr !== null ? fcrRating(fcr).label : 'Need weight sample'}
            </div>
          </div>

          {/* vs Standard */}
          {vsStandard !== null && (
            <div className={`stat-card ${vsStandard >= 0 ? 'stat-card--accent' : 'stat-card--danger'}`}>
              <div className="stat-card__label">vs Standard</div>
              <div className="stat-card__value" style={{ color: vsStandard >= 0 ? 'var(--green-400)' : 'var(--red-400)' }}>
                {vsStandard >= 0 ? '+' : ''}{vsStandard.toFixed(0)}g
              </div>
              <div className="stat-card__sub">Day {dayOfCycle} target: {stdToday}g</div>
            </div>
          )}

          {/* Latest weight */}
          {latestSample && (
            <div className="stat-card">
              <div className="stat-card__label">Latest Weight</div>
              <div className="stat-card__value">{Number(latestSample.avg_weight_g).toLocaleString()}g</div>
              <div className="stat-card__sub">{formatDate(latestSample.sample_date)}</div>
            </div>
          )}

          {/* Live birds */}
          <div className="stat-card">
            <div className="stat-card__label">Live Birds</div>
            <div className="stat-card__value">{liveBirds.toLocaleString()}</div>
            <div className="stat-card__sub">{totalMortality} mortality</div>
          </div>

          {/* Total feed */}
          <div className="stat-card">
            <div className="stat-card__label">Feed Consumed</div>
            <div className="stat-card__value">{totalFeedKg.toFixed(0)}</div>
            <div className="stat-card__sub">kg total</div>
          </div>

          {/* Weight gained */}
          {totalWeightGainedKg !== null && (
            <div className="stat-card">
              <div className="stat-card__label">Weight Gained</div>
              <div className="stat-card__value">{totalWeightGainedKg.toFixed(0)}</div>
              <div className="stat-card__sub">kg total flock</div>
            </div>
          )}
        </div>
      </div>

      {/* FCR explanation */}
      {fcr !== null && (
        <div style={{ marginBottom: '20px', padding: '12px 14px', background: 'var(--bg-card)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
          FCR = {totalFeedKg.toFixed(1)} kg feed ÷ {totalWeightGainedKg?.toFixed(1)} kg gained = <strong style={{ color: fcrRating(fcr).color }}>{fcr.toFixed(2)}</strong>
          {' '}({fcrRating(fcr).label})
          {'. '}Target for {batch.breed}: &lt;1.75
        </div>
      )}

      {/* Growth Chart */}
      <div style={{ marginBottom: '24px' }}>
        <p className="section-title">
          Growth Curve
          {hasStandard && <span style={{ color: 'var(--text-muted)', fontWeight: 400, textTransform: 'none', letterSpacing: 0, fontSize: '0.75rem', marginLeft: '6px' }}>vs {batch.breed} standard</span>}
        </p>
        {allSamples.length === 0 && !hasStandard ? (
          <div className="empty-state" style={{ padding: '24px 16px' }}>
            <div className="empty-state__icon">📈</div>
            <div className="empty-state__title">No weight samples yet</div>
            <div className="empty-state__desc">Weigh a sample of birds (aim for every 7 days) and add a sample to see the growth curve.</div>
            <Link
              href={`/sheds/${shedId}/batches/${batchId}/weights/new`}
              className="btn btn--primary"
              style={{ marginTop: '8px' }}
              id="btn-first-weight"
            >
              + Add First Sample
            </Link>
          </div>
        ) : (
          <GrowthChartClient
            breed={batch.breed}
            dayOfCycle={dayOfCycle}
            weightSamples={chartSamples}
            hasStandard={hasStandard}
          />
        )}
      </div>

      {/* Weight samples table */}
      {allSamples.length > 0 && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <p className="section-title" style={{ margin: 0 }}>Weight Samples ({allSamples.length})</p>
            <Link
              href={`/sheds/${shedId}/batches/${batchId}/weights/new`}
              className="btn btn--ghost btn--sm"
              id="btn-add-weight-2"
              style={{ width: 'auto' }}
            >
              + Add
            </Link>
          </div>
          <div className="stack stack--sm">
            {[...allSamples].reverse().map((sample, i) => {
              const sampleDay = dayForDate(sample.sample_date)
              const std = getStandardWeight(batch.breed, sampleDay)
              const diff = std ? Number(sample.avg_weight_g) - std : null
              return (
                <div key={sample.id} className="card" style={{ padding: '14px 16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.9375rem' }}>
                        {formatDate(sample.sample_date)}
                        <span style={{ color: 'var(--text-muted)', fontWeight: 400, fontSize: '0.8125rem', marginLeft: '8px' }}>Day {sampleDay}</span>
                      </div>
                      <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                        {sample.sample_size} birds weighed
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: 700, fontSize: '1.125rem' }}>
                        {Number(sample.avg_weight_g).toLocaleString()}g
                      </div>
                      {diff !== null && (
                        <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: diff >= 0 ? 'var(--green-400)' : 'var(--red-400)' }}>
                          {diff >= 0 ? '+' : ''}{diff.toFixed(0)}g vs std
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
