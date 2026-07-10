'use client'

import { useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

const CATEGORIES = [
  { value: 'chicks',     label: '🐣 Chicks',     hint: 'Day-old chick purchase cost' },
  { value: 'feed',       label: '🌾 Feed',        hint: 'Feed bags purchased this batch' },
  { value: 'medicine',   label: '💊 Medicine',    hint: 'Vaccines, medications, disinfectants' },
  { value: 'labor',      label: '👷 Labor',       hint: 'Worker wages, caretaker fees' },
  { value: 'utilities',  label: '⚡ Utilities',   hint: 'Electricity, gas, water bills' },
  { value: 'other',      label: '📦 Other',       hint: 'Litter, equipment, miscellaneous' },
] as const

type Category = typeof CATEGORIES[number]['value']

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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const supabase = createClient()

    try {
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

      router.push(`/sheds/${shedId}/batches/${batchId}/financials`)
      router.refresh()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save expense')
    } finally {
      setLoading(false)
    }
  }

  const selectedCat = CATEGORIES.find(c => c.value === category)

  return (
    <div className="container" style={{ paddingTop: '16px' }}>
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
          {selectedCat && (
            <span className="form-hint">{selectedCat.hint}</span>
          )}
        </div>

        {/* Amount */}
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

        {/* Date */}
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

        {/* Notes */}
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

        {error && (
          <div className="alert-banner alert-banner--error" role="alert">
            <span>⚠️</span>
            <span>{error}</span>
          </div>
        )}

        <div style={{ paddingTop: '8px' }}>
          <button
            id="btn-save-expense"
            type="submit"
            className="btn btn--primary"
            disabled={loading || !category || !amount || !expenseDate}
          >
            {loading ? <span className="spinner" /> : '💾 Save Expense'}
          </button>
        </div>
      </form>
    </div>
  )
}
