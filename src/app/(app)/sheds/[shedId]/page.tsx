import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'

interface Props {
  params: Promise<{ shedId: string }>
}

export async function generateMetadata({ params }: Props) {
  const { shedId } = await params
  const supabase = await createClient()
  const { data } = await supabase.from('sheds').select('name').eq('id', shedId).single()
  return { title: `${data?.name ?? 'Shed'} — FlockOps` }
}

export default async function ShedDetailPage({ params }: Props) {
  const { shedId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: shed } = await supabase
    .from('sheds')
    .select('id, name, capacity, location, farm_id, created_at')
    .eq('id', shedId)
    .single()

  if (!shed) notFound()

  // Fetch all batches for this shed, newest first
  const { data: batches } = await supabase
    .from('batches')
    .select('id, breed, placement_date, starting_bird_count, target_harvest_weight, status, created_at')
    .eq('shed_id', shedId)
    .order('created_at', { ascending: false })

  const activeBatch = batches?.find(b => b.status === 'active')
  const pastBatches = batches?.filter(b => b.status !== 'active') ?? []

  function getDayOfCycle(placementDate: string): number {
    const placed = new Date(placementDate)
    const today = new Date()
    return Math.max(0, Math.floor((today.getTime() - placed.getTime()) / (1000 * 60 * 60 * 24))) + 1
  }

  function formatDate(d: string) {
    return new Date(d).toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' })
  }

  return (
    <div className="container" style={{ paddingTop: '16px', paddingBottom: '32px' }}>
      {/* Header */}
      <div className="page-header" style={{ padding: '0 0 20px 0' }}>
        <Link href="/sheds" className="page-header__back" id="btn-back-shed-list">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </Link>
        <div className="page-header__info">
          <h1 className="page-header__title">{shed.name}</h1>
          <p className="page-header__subtitle">
            {shed.capacity.toLocaleString()} birds capacity
            {shed.location ? ` · ${shed.location}` : ''}
          </p>
        </div>
        <Link href={`/sheds/${shedId}/edit`} className="btn btn--ghost btn--sm" id="btn-edit-shed" style={{ width: 'auto', flexShrink: 0 }}>
          Edit
        </Link>
      </div>

      {/* Active Batch Section */}
      {activeBatch ? (
        <div style={{ marginBottom: '24px' }}>
          <p className="section-title">Active Batch</p>
          <div className="card" style={{ borderColor: 'rgba(34,197,94,0.2)', background: 'linear-gradient(135deg, rgba(34,197,94,0.06), var(--bg-card))' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: '1.125rem' }}>{activeBatch.breed}</div>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: '2px' }}>
                  Started {formatDate(activeBatch.placement_date)}
                </div>
              </div>
              <span className="badge badge--active">Day {getDayOfCycle(activeBatch.placement_date)}</span>
            </div>

            <div className="stat-grid" style={{ marginBottom: '16px' }}>
              <div className="stat-card stat-card--accent">
                <div className="stat-card__label">Birds Placed</div>
                <div className="stat-card__value">{activeBatch.starting_bird_count.toLocaleString()}</div>
              </div>
              <div className="stat-card">
                <div className="stat-card__label">Target Weight</div>
                <div className="stat-card__value">
                  {activeBatch.target_harvest_weight ? `${activeBatch.target_harvest_weight} kg` : '—'}
                </div>
              </div>
            </div>

            <div className="stack stack--sm">
              <Link
                href={`/sheds/${shedId}/batches/${activeBatch.id}/log`}
                className="btn btn--primary"
                id="btn-daily-log"
              >
                📋 Enter Daily Log
              </Link>
              <Link
                href={`/sheds/${shedId}/batches/${activeBatch.id}`}
                className="btn btn--secondary"
                id="btn-view-batch"
              >
                View Batch Details
              </Link>
            </div>
          </div>
        </div>
      ) : (
        <div style={{ marginBottom: '24px' }}>
          <p className="section-title">Active Batch</p>
          <div className="card" style={{ textAlign: 'center', padding: '32px 16px' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>🐣</div>
            <div style={{ fontWeight: 600, marginBottom: '6px', color: 'var(--text-secondary)' }}>No active batch</div>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '20px' }}>
              Start a new batch when you place chicks in this shed.
            </p>
            <Link
              href={`/sheds/${shedId}/batches/new`}
              className="btn btn--primary"
              id="btn-start-batch"
              style={{ display: 'inline-flex', width: 'auto', padding: '14px 24px' }}
            >
              🐔 Start New Batch
            </Link>
          </div>
        </div>
      )}

      {/* Batch History */}
      {pastBatches.length > 0 && (
        <div>
          <p className="section-title">Batch History ({pastBatches.length})</p>
          <div className="stack stack--sm">
            {pastBatches.map(batch => (
              <Link
                key={batch.id}
                href={`/sheds/${shedId}/batches/${batch.id}`}
                className="list-item"
                id={`batch-history-${batch.id}`}
              >
                <div className="list-item__icon" style={{ background: 'var(--bg-elevated)' }}>📦</div>
                <div className="list-item__body">
                  <div className="list-item__title">{batch.breed}</div>
                  <div className="list-item__subtitle">
                    {formatDate(batch.placement_date)} · {batch.starting_bird_count.toLocaleString()} birds
                  </div>
                </div>
                <div className="list-item__right">
                  <span className={`badge badge--${batch.status}`}>{batch.status}</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
