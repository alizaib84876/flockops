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
  return { title: `Financials — ${data?.breed ?? 'Batch'} — FlockOps` }
}

const CATEGORY_META: Record<string, { label: string; icon: string }> = {
  chicks:    { label: 'Chicks',    icon: '🐣' },
  feed:      { label: 'Feed',      icon: '🌾' },
  medicine:  { label: 'Medicine',  icon: '💊' },
  labor:     { label: 'Labor',     icon: '👷' },
  utilities: { label: 'Utilities', icon: '⚡' },
  other:     { label: 'Other',     icon: '📦' },
}

export default async function FinancialsPage({ params }: Props) {
  const { shedId, batchId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Batch info
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

  // All expenses for this batch
  const { data: expenses } = await supabase
    .from('expenses')
    .select('id, category, amount, expense_date, notes')
    .eq('batch_id', batchId)
    .order('expense_date', { ascending: false })

  const allExpenses = expenses ?? []

  // All sales for this batch (multiple brokers)
  const { data: sales } = await supabase
    .from('sales')
    .select('id, sale_date, buyer_name, total_weight_kg, rate_per_kg, condemned_birds_count, total_amount, notes')
    .eq('batch_id', batchId)
    .order('sale_date', { ascending: true })

  const allSales = sales ?? []
  const revenue = allSales.reduce((s, r) => s + Number(r.total_amount), 0)
  const totalWeightSold = allSales.reduce((s, r) => s + Number(r.total_weight_kg), 0)
  const totalCondemned = allSales.reduce((s, r) => s + Number(r.condemned_birds_count), 0)

  // Totals
  const totalExpenses = allExpenses.reduce((s, e) => s + Number(e.amount), 0)
  const profitLoss = revenue - totalExpenses
  const isProfit = profitLoss >= 0


  // Per-category breakdown
  const byCategory = allExpenses.reduce<Record<string, number>>((acc, e) => {
    acc[e.category] = (acc[e.category] ?? 0) + Number(e.amount)
    return acc
  }, {})

  const sortedCategories = Object.entries(byCategory).sort(([, a], [, b]) => b - a)

  // Per-bird and per-kg calculations
  const costPerBird = batch.starting_bird_count > 0
    ? totalExpenses / batch.starting_bird_count
    : null
  const costPerKg = totalWeightSold > 0
    ? totalExpenses / totalWeightSold
    : null
  const revenuePerKg = totalWeightSold > 0 && revenue > 0
    ? revenue / totalWeightSold
    : null
  const profitPerBird = batch.starting_bird_count > 0
    ? profitLoss / batch.starting_bird_count
    : null

  const isActive = batch.status === 'active'

  function formatPKR(n: number) {
    return `₨ ${Math.abs(n).toLocaleString('en-PK', { maximumFractionDigits: 0 })}`
  }

  function formatDate(d: string) {
    return new Date(d).toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' })
  }

  return (
    <div className="container" style={{ paddingTop: '16px', paddingBottom: '40px' }}>
      {/* Header */}
      <div className="page-header" style={{ padding: '0 0 20px 0' }}>
        <Link href={`/sheds/${shedId}/batches/${batchId}`} className="page-header__back" id="btn-back-batch-fin">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </Link>
        <div className="page-header__info">
          <h1 className="page-header__title">Financials</h1>
          <p className="page-header__subtitle">{shed?.name} · {batch.breed}</p>
        </div>
        <Link
          href={`/sheds/${shedId}/batches/${batchId}/expenses/new`}
          className="btn btn--primary btn--sm"
          id="btn-add-expense"
          style={{ width: 'auto', flexShrink: 0 }}
        >
          + Expense
        </Link>
      </div>

      {/* P&L Summary */}
      <div style={{ marginBottom: '24px' }}>
        <p className="section-title">Profit & Loss</p>

        {/* Big P&L card */}
        <div className="card" style={{
          borderColor: revenue > 0 ? (isProfit ? 'rgba(34,197,94,0.25)' : 'rgba(239,68,68,0.25)') : 'var(--border-subtle)',
          background: revenue > 0
            ? isProfit
              ? 'linear-gradient(135deg, rgba(34,197,94,0.07), var(--bg-card))'
              : 'linear-gradient(135deg, rgba(239,68,68,0.07), var(--bg-card))'
            : undefined,
          marginBottom: '12px',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
            <div>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: '6px' }}>
                Net {revenue > 0 ? (isProfit ? 'Profit' : 'Loss') : '(Pending Sale)'}
              </div>
              <div style={{
                fontSize: '2rem',
                fontWeight: 800,
                color: revenue > 0 ? (isProfit ? 'var(--green-400)' : 'var(--red-400)') : 'var(--text-muted)',
              }}>
                {revenue > 0 ? `${isProfit ? '+' : '-'}${formatPKR(profitLoss)}` : '—'}
              </div>
            </div>
            {revenue > 0 && (
              <span style={{
                fontSize: '2rem',
                lineHeight: 1,
              }}>
                {isProfit ? '📈' : '📉'}
              </span>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Revenue</div>
              <div style={{ fontWeight: 700, fontSize: '1.125rem', color: 'var(--green-400)', marginTop: '2px' }}>
                {revenue > 0 ? formatPKR(revenue) : '—'}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Total Expenses</div>
              <div style={{ fontWeight: 700, fontSize: '1.125rem', color: 'var(--red-400)', marginTop: '2px' }}>
                {totalExpenses > 0 ? formatPKR(totalExpenses) : '—'}
              </div>
            </div>
          </div>
        </div>

        {/* Per-unit metrics */}
        {(costPerBird !== null || costPerKg !== null) && (
          <div className="stat-grid">
            {costPerBird !== null && (
              <div className="stat-card">
                <div className="stat-card__label">Cost / Bird</div>
                <div className="stat-card__value" style={{ fontSize: '1.1rem' }}>
                  ₨{Math.round(costPerBird).toLocaleString()}
                </div>
                <div className="stat-card__sub">{batch.starting_bird_count.toLocaleString()} birds</div>
              </div>
            )}
            {costPerKg !== null && (
              <div className="stat-card">
                <div className="stat-card__label">Cost / kg</div>
                <div className="stat-card__value" style={{ fontSize: '1.1rem' }}>₨{Math.round(costPerKg).toLocaleString()}</div>
                <div className="stat-card__sub">vs ₨{Math.round(revenuePerKg!)} revenue/kg</div>
              </div>
            )}
            {profitPerBird !== null && revenue > 0 && (
              <div className={`stat-card ${isProfit ? '' : 'stat-card--danger'}`}>
                <div className="stat-card__label">{isProfit ? 'Profit' : 'Loss'} / Bird</div>
                <div className="stat-card__value" style={{ fontSize: '1.1rem', color: isProfit ? 'var(--green-400)' : 'var(--red-400)' }}>
                  ₨{Math.abs(Math.round(profitPerBird)).toLocaleString()}
                </div>
                <div className="stat-card__sub">{isProfit ? 'per bird placed' : 'per bird placed'}</div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Sales record — multi-broker summary */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <p className="section-title" style={{ margin: 0 }}>Broker Sales ({allSales.length})</p>
          <Link
            href={`/sheds/${shedId}/batches/${batchId}/sales`}
            className="btn btn--ghost btn--sm"
            id="btn-manage-sales"
            style={{ width: 'auto' }}
          >
            {allSales.length > 0 ? 'Manage' : '+ Record'}
          </Link>
        </div>

        {allSales.length === 0 ? (
          <div className="card" style={{ padding: '24px 16px', textAlign: 'center' }}>
            <div style={{ fontSize: '2rem', marginBottom: '8px' }}>🤝</div>
            <div style={{ fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>No sales recorded yet</div>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
              Record each broker sale separately. Multiple brokers supported.
            </p>
            <Link
              href={`/sheds/${shedId}/batches/${batchId}/sales`}
              className="btn btn--primary"
              id="btn-record-sale-cta"
              style={{ display: 'inline-flex', width: 'auto', padding: '14px 24px' }}
            >
              🤝 Record Sales
            </Link>
          </div>
        ) : (
          <div className="stack stack--sm">
            {allSales.map((s, idx) => (
              <div key={s.id} className="card" style={{ padding: '14px 16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 600 }}>{s.buyer_name || `Broker ${idx + 1}`}</div>
                    <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                      {formatDate(s.sale_date)} · {Number(s.total_weight_kg).toLocaleString()} kg · ₨{Number(s.rate_per_kg)}/kg
                    </div>
                  </div>
                  <div style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--green-400)' }}>
                    {formatPKR(Number(s.total_amount))}
                  </div>
                </div>
              </div>
            ))}
            <div style={{ padding: '12px 14px', background: 'var(--accent-dim)', borderRadius: 'var(--radius-md)', display: 'flex', justifyContent: 'space-between', fontSize: '0.9375rem' }}>
              <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Total revenue · {totalWeightSold.toLocaleString()} kg sold</span>
              <span style={{ fontWeight: 800, color: 'var(--green-400)' }}>{formatPKR(revenue)}</span>
            </div>
          </div>
        )}
      </div>


      {/* Expense breakdown by category */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <p className="section-title" style={{ margin: 0 }}>Expenses ({allExpenses.length})</p>
          <Link
            href={`/sheds/${shedId}/batches/${batchId}/expenses/new`}
            className="btn btn--ghost btn--sm"
            id="btn-add-expense-2"
            style={{ width: 'auto' }}
          >
            + Add
          </Link>
        </div>

        {allExpenses.length === 0 ? (
          <div className="card" style={{ padding: '24px 16px', textAlign: 'center' }}>
            <div style={{ fontSize: '2rem', marginBottom: '8px' }}>📋</div>
            <div style={{ fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>No expenses logged</div>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
              Log chick costs, feed, medicine, and labor to see your total cost of production.
            </p>
            <Link
              href={`/sheds/${shedId}/batches/${batchId}/expenses/new`}
              className="btn btn--primary"
              id="btn-first-expense"
              style={{ display: 'inline-flex', width: 'auto', padding: '14px 24px' }}
            >
              + Add First Expense
            </Link>
          </div>
        ) : (
          <div className="stack stack--sm">
            {/* Category totals bar */}
            {sortedCategories.length > 0 && (
              <div className="card" style={{ padding: '16px', marginBottom: '4px' }}>
                <div style={{ marginBottom: '12px', display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>By Category</span>
                  <span style={{ fontSize: '0.9375rem', fontWeight: 800 }}>{formatPKR(totalExpenses)}</span>
                </div>
                <div className="stack" style={{ gap: '8px' }}>
                  {sortedCategories.map(([cat, total]) => {
                    const meta = CATEGORY_META[cat] ?? { label: cat, icon: '📦' }
                    const pct = totalExpenses > 0 ? (total / totalExpenses) * 100 : 0
                    return (
                      <div key={cat}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '0.875rem' }}>
                          <span style={{ fontWeight: 600 }}>{meta.icon} {meta.label}</span>
                          <span style={{ color: 'var(--text-muted)' }}>
                            {formatPKR(total)}
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginLeft: '6px' }}>
                              {pct.toFixed(0)}%
                            </span>
                          </span>
                        </div>
                        <div style={{ height: '6px', background: 'var(--bg-elevated)', borderRadius: '3px', overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${pct}%`, background: 'var(--accent)', borderRadius: '3px', transition: 'width 0.4s ease' }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Individual expense rows */}
            {allExpenses.map(expense => {
              const meta = CATEGORY_META[expense.category] ?? { label: expense.category, icon: '📦' }
              return (
                <div key={expense.id} className="list-item" style={{ alignItems: 'center' }}>
                  <div className="list-item__icon" style={{ background: 'var(--bg-elevated)', fontSize: '1.125rem' }}>
                    {meta.icon}
                  </div>
                  <div className="list-item__body">
                    <div className="list-item__title">{meta.label}</div>
                    <div className="list-item__subtitle">
                      {formatDate(expense.expense_date)}
                      {expense.notes && ` · ${expense.notes}`}
                    </div>
                  </div>
                  <div className="list-item__right" style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 700, fontSize: '1rem' }}>
                      {formatPKR(Number(expense.amount))}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Close batch CTA for active batches */}
      {isActive && (
        <div style={{ paddingTop: '8px' }}>
          <Link
            href={`/sheds/${shedId}/batches/${batchId}/close`}
            className="btn btn--secondary"
            id="btn-close-batch-fin"
          >
            🏁 Close / Harvest Batch
          </Link>
        </div>
      )}
    </div>
  )
}
