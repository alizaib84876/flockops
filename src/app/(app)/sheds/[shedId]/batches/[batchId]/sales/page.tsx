import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import CloseBatchButton from './CloseBatchButton'

interface Props {
  params: Promise<{ shedId: string; batchId: string }>
}

export const metadata = { title: 'Sales — FlockOps' }

export default async function SalesPage({ params }: Props) {
  const { shedId, batchId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: batch } = await supabase
    .from('batches')
    .select('id, breed, placement_date, starting_bird_count, status')
    .eq('id', batchId)
    .eq('shed_id', shedId)
    .single()

  if (!batch) notFound()

  const { data: shed } = await supabase
    .from('sheds')
    .select('name')
    .eq('id', shedId)
    .single()

  // All sales for this batch
  const { data: sales } = await supabase
    .from('sales')
    .select('id, sale_date, buyer_name, total_weight_kg, rate_per_kg, condemned_birds_count, total_amount, notes')
    .eq('batch_id', batchId)
    .order('sale_date', { ascending: true })

  const allSales = sales ?? []

  // Mortality to estimate live birds
  const { data: logs } = await supabase
    .from('daily_logs')
    .select('mortality_count')
    .eq('batch_id', batchId)

  const totalMortality = (logs ?? []).reduce((s, l) => s + Number(l.mortality_count), 0)
  const liveBirds = batch.starting_bird_count - totalMortality

  // Running totals
  const totalWeightSold = allSales.reduce((s, sale) => s + Number(sale.total_weight_kg), 0)
  const totalRevenue = allSales.reduce((s, sale) => s + Number(sale.total_amount), 0)
  const totalCondemned = allSales.reduce((s, sale) => s + Number(sale.condemned_birds_count), 0)

  const isActive = batch.status === 'active'

  function formatPKR(n: number) {
    return `₨ ${Math.round(n).toLocaleString('en-PK')}`
  }
  function formatDate(d: string) {
    return new Date(d).toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' })
  }
  function avgRate() {
    if (totalWeightSold === 0) return null
    return totalRevenue / totalWeightSold
  }

  return (
    <div className="container" style={{ paddingTop: '16px', paddingBottom: '40px' }}>
      {/* Header */}
      <div className="page-header" style={{ padding: '0 0 20px 0' }}>
        <Link href={`/sheds/${shedId}/batches/${batchId}`} className="page-header__back" id="btn-back-batch-sales">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </Link>
        <div className="page-header__info">
          <h1 className="page-header__title">Sales</h1>
          <p className="page-header__subtitle">{shed?.name} · {batch.breed}</p>
        </div>
        {isActive && (
          <Link
            href={`/sheds/${shedId}/batches/${batchId}/sales/new`}
            className="btn btn--primary btn--sm"
            id="btn-add-sale"
            style={{ width: 'auto', flexShrink: 0 }}
          >
            + Sale
          </Link>
        )}
      </div>

      {/* Running totals */}
      {allSales.length > 0 && (
        <div style={{ marginBottom: '24px' }}>
          <p className="section-title">Running Totals</p>
          <div className="stat-grid">
            <div className="stat-card stat-card--accent">
              <div className="stat-card__label">Total Revenue</div>
              <div className="stat-card__value" style={{ fontSize: '1.1rem', color: 'var(--green-400)' }}>
                ₨{Math.round(totalRevenue).toLocaleString()}
              </div>
              <div className="stat-card__sub">{allSales.length} broker{allSales.length !== 1 ? 's' : ''}</div>
            </div>
            <div className="stat-card">
              <div className="stat-card__label">Weight Sold</div>
              <div className="stat-card__value">{totalWeightSold.toLocaleString()}</div>
              <div className="stat-card__sub">kg</div>
            </div>
            <div className="stat-card">
              <div className="stat-card__label">Avg Rate</div>
              <div className="stat-card__value" style={{ fontSize: '1.1rem' }}>
                {avgRate() ? `₨${Math.round(avgRate()!)}` : '—'}
              </div>
              <div className="stat-card__sub">per kg (blended)</div>
            </div>
            {totalCondemned > 0 && (
              <div className="stat-card stat-card--danger">
                <div className="stat-card__label">Condemned</div>
                <div className="stat-card__value">{totalCondemned}</div>
                <div className="stat-card__sub">birds rejected</div>
              </div>
            )}
          </div>

          {/* Weight sold vs live birds progress bar */}
          <div style={{ marginTop: '12px', padding: '14px 16px', background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem', marginBottom: '8px' }}>
              <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Weight sold of est. flock</span>
              <span style={{ fontWeight: 700 }}>
                {totalWeightSold.toLocaleString()} kg sold
              </span>
            </div>
            <div style={{ height: '8px', background: 'var(--bg-elevated)', borderRadius: '4px', overflow: 'hidden' }}>
              {/* Rough estimate: ~2kg per bird at harvest */}
              <div style={{
                height: '100%',
                width: `${Math.min(100, (totalWeightSold / (liveBirds * 2)) * 100).toFixed(0)}%`,
                background: 'var(--accent)',
                borderRadius: '4px',
                transition: 'width 0.4s ease',
              }} />
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '6px' }}>
              Estimated live birds: {liveBirds.toLocaleString()} · Avg ~2 kg/bird
            </div>
          </div>
        </div>
      )}

      {/* Sales list */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <p className="section-title" style={{ margin: 0 }}>Broker Sales ({allSales.length})</p>
        </div>

        {allSales.length === 0 ? (
          <div className="card" style={{ padding: '32px 16px', textAlign: 'center' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>🤝</div>
            <div style={{ fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>No sales recorded yet</div>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '20px' }}>
              Record each broker sale separately. You can add multiple sales before closing the batch.
            </p>
            {isActive && (
              <Link
                href={`/sheds/${shedId}/batches/${batchId}/sales/new`}
                className="btn btn--primary"
                id="btn-first-sale"
                style={{ display: 'inline-flex', width: 'auto', padding: '14px 24px' }}
              >
                + Record First Sale
              </Link>
            )}
          </div>
        ) : (
          <div className="stack stack--sm">
            {allSales.map((sale, idx) => (
              <div key={sale.id} className="card" style={{ padding: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '1rem' }}>
                      {sale.buyer_name || `Broker ${idx + 1}`}
                    </div>
                    <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                      {formatDate(sale.sale_date)}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 800, fontSize: '1.125rem', color: 'var(--green-400)' }}>
                      {formatPKR(Number(sale.total_amount))}
                    </div>
                    <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                      ₨{Number(sale.rate_per_kg)}/kg
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '16px', fontSize: '0.8125rem', flexWrap: 'wrap', color: 'var(--text-muted)' }}>
                  <span>Weight: <strong style={{ color: 'var(--text-secondary)' }}>{Number(sale.total_weight_kg).toLocaleString()} kg</strong></span>
                  {Number(sale.condemned_birds_count) > 0 && (
                    <span>Condemned: <strong style={{ color: 'var(--red-400)' }}>{sale.condemned_birds_count}</strong></span>
                  )}
                  {sale.notes && <span>Note: {sale.notes}</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Close batch section */}
      {isActive && (
        <div>
          <p className="section-title">Close Batch</p>
          <div className="card" style={{ borderColor: 'rgba(239,68,68,0.15)' }}>
            <p style={{ fontSize: '0.9375rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
              {allSales.length === 0
                ? 'You can close the batch without recording a sale, or add at least one sale first.'
                : `All ${allSales.length} sale${allSales.length !== 1 ? 's' : ''} recorded (${formatPKR(totalRevenue)} total). Close this batch when all birds have been sold.`}
            </p>
            <CloseBatchButton batchId={batchId} shedId={shedId} />
          </div>
        </div>
      )}

      {!isActive && (
        <div className="alert-banner alert-banner--success">
          <span>✅</span>
          <span>This batch is closed. No further sales can be added.</span>
        </div>
      )}
    </div>
  )
}
