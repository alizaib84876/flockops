'use client'

import { useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

const CATEGORIES = [
  { value: 'chicks',     label: '🐣 Chicks',     hint: 'Day-old chick purchase cost' },
  { value: 'feed',       label: '🌾 Feed',        hint: 'Feed bags purchased this batch' },
  { value: 'medicine',   label: '💊 Medicine',    hint: 'Vaccines, medications, disinfectants' },
  { value: 'labor',      label: '👷 Labor',       hint: 'Worker wages — add each worker below' },
  { value: 'utilities',  label: '⚡ Utilities',   hint: 'Electricity, gas, water bills' },
  { value: 'other',      label: '📦 Other',       hint: 'Litter, equipment, miscellaneous' },
] as const

type Category = typeof CATEGORIES[number]['value']

interface Worker {
  id: string
  name: string
  wages: string     // total wages owed
  advance: string   // advance already given (deducted)
}

function makeWorker(): Worker {
  return { id: crypto.randomUUID(), name: '', wages: '', advance: '0' }
}

function netPayable(w: Worker): number {
  const wages = parseFloat(w.wages) || 0
  const advance = parseFloat(w.advance) || 0
  return Math.max(0, wages - advance)
}

export default function NewExpensePage() {
  const router = useRouter()
  const params = useParams()
  const shedId = params.shedId as string
  const batchId = params.batchId as string

  const today = new Date().toISOString().split('T')[0]

  const [category, setCategory] = useState<Category | ''>('')
  const [amount, setAmount] = useState('')
  const [expenseDate, setExpenseDate] = useState(today)
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Labor-specific state
  const [workers, setWorkers] = useState<Worker[]>([makeWorker()])

  const isLabor = category === 'labor'
  const selectedCat = CATEGORIES.find(c => c.value === category)

  function updateWorker(id: string, field: keyof Worker, val: string) {
    setWorkers(ws => ws.map(w => w.id === id ? { ...w, [field]: val } : w))
  }

  function addWorker() {
    setWorkers(ws => [...ws, makeWorker()])
  }

  function removeWorker(id: string) {
    setWorkers(ws => ws.filter(w => w.id !== id))
  }

  const totalLaborWages = workers.reduce((s, w) => s + (parseFloat(w.wages) || 0), 0)
  const totalLaborAdvance = workers.reduce((s, w) => s + (parseFloat(w.advance) || 0), 0)
  const totalLaborNet = workers.reduce((s, w) => s + netPayable(w), 0)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const supabase = createClient()

    try {
      if (isLabor) {
        // Validate all workers have at least a name and wages
        const invalidWorker = workers.find(w => !w.name.trim() || !w.wages)
        if (invalidWorker) throw new Error('Fill in name and wages for every worker.')

        // Insert one expense row per worker
        const rows = workers.map(w => ({
          batch_id: batchId,
          category: 'labor' as const,
          amount: parseFloat(w.wages),
          expense_date: expenseDate,
          notes: [
            `Worker: ${w.name.trim()}`,
            parseFloat(w.advance) > 0 ? `Advance: ₨${parseFloat(w.advance).toLocaleString()}` : null,
            `Balance due: ₨${netPayable(w).toLocaleString()}`,
          ].filter(Boolean).join(' | '),
        }))

        const { error: insertErr } = await supabase.from('expenses').insert(rows)
        if (insertErr) throw insertErr
      } else {
        const { error: insertErr } = await supabase
          .from('expenses')
          .insert({
            batch_id: batchId,
            category: category as Category,
            amount: parseFloat(amount),
            expense_date: expenseDate,
            notes: notes.trim() || null,
          })

        if (insertErr) throw insertErr
      }

      router.push(`/sheds/${shedId}/batches/${batchId}/financials`)
      router.refresh()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save expense')
    } finally {
      setLoading(false)
    }
  }

  const isSubmitDisabled = loading
    || !category
    || !expenseDate
    || (isLabor ? workers.length === 0 : !amount)

  return (
    <div className="container" style={{ paddingTop: '16px', paddingBottom: '32px' }}>
      <div className="page-header" style={{ padding: '0 0 24px 0' }}>
        <Link href={`/sheds/${shedId}/batches/${batchId}/financials`} className="page-header__back" id="btn-back-financials">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </Link>
        <div className="page-header__info">
          <h1 className="page-header__title">Add Expense</h1>
          <p className="page-header__subtitle">Log a cost for this batch</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="stack stack--md">
        {/* Category picker */}
        <div className="form-group">
          <label className="form-label form-label--required">Category</label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            {CATEGORIES.map(cat => (
              <button
                key={cat.value}
                type="button"
                id={`cat-${cat.value}`}
                onClick={() => setCategory(cat.value)}
                style={{
                  padding: '14px 12px',
                  borderRadius: 'var(--radius-md)',
                  border: `1.5px solid ${category === cat.value ? 'var(--accent)' : 'var(--border)'}`,
                  background: category === cat.value ? 'var(--accent-dim)' : 'var(--bg-elevated)',
                  color: category === cat.value ? 'var(--accent)' : 'var(--text-secondary)',
                  fontWeight: 600,
                  fontSize: '0.9375rem',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all var(--transition)',
                  fontFamily: 'inherit',
                }}
              >
                {cat.label}
              </button>
            ))}
          </div>
          {selectedCat && <span className="form-hint">{selectedCat.hint}</span>}
        </div>

        {/* Date — always visible */}
        <div className="form-group">
          <label htmlFor="expense-date" className="form-label form-label--required">Date</label>
          <input
            id="expense-date"
            type="date"
            className="form-input"
            value={expenseDate}
            onChange={e => setExpenseDate(e.target.value)}
            required
            max={today}
          />
        </div>

        {/* ── Non-labor fields ── */}
        {category && !isLabor && (
          <>
            <div className="form-group">
              <label htmlFor="expense-amount" className="form-label form-label--required">
                Amount
                <span style={{ color: 'var(--text-muted)', fontWeight: 400, marginLeft: '4px', fontSize: '0.8125rem' }}>(PKR)</span>
              </label>
              <input
                id="expense-amount"
                type="number"
                className="form-input"
                placeholder="e.g. 50000"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                required
                min="0"
                step="1"
                inputMode="numeric"
                style={{ fontSize: '1.25rem', fontWeight: 700 }}
              />
            </div>

            <div className="form-group">
              <label htmlFor="expense-notes" className="form-label">
                Notes <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(optional)</span>
              </label>
              <input
                id="expense-notes"
                type="text"
                className="form-input"
                placeholder="e.g. 10 bags Super Feed, invoice #123"
                value={notes}
                onChange={e => setNotes(e.target.value)}
              />
            </div>
          </>
        )}

        {/* ── Labor: per-worker form ── */}
        {isLabor && (
          <div>
            <p className="section-title" style={{ marginBottom: '12px' }}>Workers</p>

            <div className="stack stack--md">
              {workers.map((w, idx) => (
                <div
                  key={w.id}
                  style={{
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-md)',
                    padding: '16px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <span style={{ fontWeight: 700, fontSize: '0.9375rem', color: 'var(--text-secondary)' }}>
                      Worker {idx + 1}
                    </span>
                    {workers.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeWorker(w.id)}
                        id={`btn-remove-worker-${idx}`}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--red-400)',
                          cursor: 'pointer',
                          fontSize: '1.125rem',
                          padding: '4px',
                          lineHeight: 1,
                        }}
                        aria-label={`Remove worker ${idx + 1}`}
                      >
                        ✕
                      </button>
                    )}
                  </div>

                  <div className="stack" style={{ gap: '12px' }}>
                    <div className="form-group">
                      <label htmlFor={`worker-name-${idx}`} className="form-label form-label--required">Name</label>
                      <input
                        id={`worker-name-${idx}`}
                        type="text"
                        className="form-input"
                        placeholder="e.g. Muhammad Aslam"
                        value={w.name}
                        onChange={e => updateWorker(w.id, 'name', e.target.value)}
                        required
                      />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                      <div className="form-group">
                        <label htmlFor={`worker-wages-${idx}`} className="form-label form-label--required">
                          Total Wages <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>PKR</span>
                        </label>
                        <input
                          id={`worker-wages-${idx}`}
                          type="number"
                          className="form-input"
                          placeholder="e.g. 20000"
                          value={w.wages}
                          onChange={e => updateWorker(w.id, 'wages', e.target.value)}
                          required
                          min="0"
                          inputMode="numeric"
                        />
                      </div>

                      <div className="form-group">
                        <label htmlFor={`worker-advance-${idx}`} className="form-label">
                          Advance Given <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>PKR</span>
                        </label>
                        <input
                          id={`worker-advance-${idx}`}
                          type="number"
                          className="form-input"
                          placeholder="0"
                          value={w.advance}
                          onChange={e => updateWorker(w.id, 'advance', e.target.value)}
                          min="0"
                          inputMode="numeric"
                        />
                      </div>
                    </div>

                    {/* Net payable preview */}
                    {w.wages && (
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '10px 12px',
                        background: 'var(--accent-dim)',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: '0.875rem',
                      }}>
                        <span style={{ color: 'var(--text-muted)' }}>Balance due now:</span>
                        <span style={{ fontWeight: 800, color: 'var(--accent)', fontSize: '1rem' }}>
                          ₨ {netPayable(w).toLocaleString()}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Add worker button */}
            <button
              type="button"
              id="btn-add-worker"
              onClick={addWorker}
              style={{
                marginTop: '12px',
                width: '100%',
                padding: '14px',
                background: 'none',
                border: '1.5px dashed var(--border)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--text-muted)',
                fontWeight: 600,
                fontSize: '0.9375rem',
                cursor: 'pointer',
                fontFamily: 'inherit',
                transition: 'all var(--transition)',
              }}
            >
              + Add Another Worker
            </button>

            {/* Labor summary */}
            {totalLaborWages > 0 && (
              <div style={{
                marginTop: '16px',
                padding: '14px 16px',
                background: 'var(--bg-card)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
              }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: '10px' }}>
                  Payroll Summary — {workers.length} worker{workers.length !== 1 ? 's' : ''}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                  <div>
                    <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginBottom: '2px' }}>Total Wages</div>
                    <div style={{ fontWeight: 700 }}>₨{totalLaborWages.toLocaleString()}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginBottom: '2px' }}>Total Advance</div>
                    <div style={{ fontWeight: 700, color: 'var(--amber-400)' }}>₨{totalLaborAdvance.toLocaleString()}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginBottom: '2px' }}>Balance Due</div>
                    <div style={{ fontWeight: 800, color: 'var(--accent)' }}>₨{totalLaborNet.toLocaleString()}</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {error && (
          <div className="alert-banner alert-banner--error" role="alert">
            <span>⚠️</span>
            <span>{error}</span>
          </div>
        )}

        {category && (
          <div style={{ paddingTop: '8px' }}>
            <button
              id="btn-save-expense"
              type="submit"
              className="btn btn--primary"
              disabled={isSubmitDisabled}
            >
              {loading ? <span className="spinner" /> : isLabor ? `💾 Save Payroll (${workers.length} worker${workers.length !== 1 ? 's' : ''})` : '💾 Save Expense'}
            </button>
          </div>
        )}
      </form>
    </div>
  )
}
