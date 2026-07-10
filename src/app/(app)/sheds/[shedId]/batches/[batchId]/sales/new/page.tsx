'use client'

import { useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function NewSalePage() {
  const router = useRouter()
  const params = useParams()
  const shedId = params.shedId as string
  const batchId = params.batchId as string

  const today = new Date().toISOString().split('T')[0]

  const [saleDate, setSaleDate] = useState(today)
  const [buyerName, setBuyerName] = useState('')
  const [totalWeightKg, setTotalWeightKg] = useState('')
  const [ratePerKg, setRatePerKg] = useState('')
  const [condemnedBirds, setCondemnedBirds] = useState('0')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const totalAmount = totalWeightKg && ratePerKg
    ? Math.round(parseFloat(totalWeightKg) * parseFloat(ratePerKg))
    : null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const supabase = createClient()

    try {
      const { error: insertErr } = await supabase
        .from('sales')
        .insert({
          batch_id: batchId,
          sale_date: saleDate,
          buyer_name: buyerName.trim() || null,
          total_weight_kg: parseFloat(totalWeightKg),
          rate_per_kg: parseFloat(ratePerKg),
          condemned_birds_count: parseInt(condemnedBirds, 10) || 0,
          total_amount: totalAmount ?? parseFloat(totalWeightKg) * parseFloat(ratePerKg),
          notes: notes.trim() || null,
        })

      if (insertErr) throw insertErr

      router.push(`/sheds/${shedId}/batches/${batchId}/sales`)
      router.refresh()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to record sale')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container" style={{ paddingTop: '16px', paddingBottom: '32px' }}>
      <div className="page-header" style={{ padding: '0 0 24px 0' }}>
        <Link href={`/sheds/${shedId}/batches/${batchId}/sales`} className="page-header__back" id="btn-back-sales">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </Link>
        <div className="page-header__info">
          <h1 className="page-header__title">Record Sale</h1>
          <p className="page-header__subtitle">Add a broker sale for this batch</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="stack stack--md">
        <div className="form-group">
          <label htmlFor="sale-date" className="form-label form-label--required">Sale Date</label>
          <input
            id="sale-date"
            type="date"
            className="form-input"
            value={saleDate}
            onChange={e => setSaleDate(e.target.value)}
            required
            max={today}
          />
        </div>

        <div className="form-group">
          <label htmlFor="buyer-name" className="form-label">
            Broker / Buyer Name{' '}
            <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(optional)</span>
          </label>
          <input
            id="buyer-name"
            type="text"
            className="form-input"
            placeholder="e.g. Al-Baraka Poultry Traders"
            value={buyerName}
            onChange={e => setBuyerName(e.target.value)}
            autoFocus
          />
        </div>

        <div className="form-group">
          <label htmlFor="total-weight" className="form-label form-label--required">
            Weight Sold{' '}
            <span style={{ color: 'var(--text-muted)', fontWeight: 400, fontSize: '0.8125rem' }}>(kg)</span>
          </label>
          <input
            id="total-weight"
            type="number"
            className="form-input"
            placeholder="e.g. 12000"
            value={totalWeightKg}
            onChange={e => setTotalWeightKg(e.target.value)}
            required
            min="0"
            step="0.1"
            inputMode="decimal"
          />
        </div>

        <div className="form-group">
          <label htmlFor="rate-per-kg" className="form-label form-label--required">
            Rate per kg{' '}
            <span style={{ color: 'var(--text-muted)', fontWeight: 400, fontSize: '0.8125rem' }}>(PKR)</span>
          </label>
          <input
            id="rate-per-kg"
            type="number"
            className="form-input"
            placeholder="e.g. 320"
            value={ratePerKg}
            onChange={e => setRatePerKg(e.target.value)}
            required
            min="0"
            step="1"
            inputMode="numeric"
          />
        </div>

        {/* Live revenue preview */}
        {totalAmount !== null && (
          <div style={{
            padding: '16px',
            background: 'var(--accent-dim)',
            border: '1px solid rgba(34,197,94,0.2)',
            borderRadius: 'var(--radius-md)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}>
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                This Sale
              </div>
              <div style={{ fontWeight: 800, fontSize: '1.5rem', color: 'var(--green-400)', marginTop: '2px' }}>
                ₨ {totalAmount.toLocaleString()}
              </div>
            </div>
            <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', textAlign: 'right' }}>
              {totalWeightKg} kg × ₨{ratePerKg}
            </div>
          </div>
        )}

        <div className="form-group">
          <label htmlFor="condemned-birds" className="form-label">
            Condemned Birds{' '}
            <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(optional)</span>
          </label>
          <input
            id="condemned-birds"
            type="number"
            className="form-input"
            placeholder="0"
            value={condemnedBirds}
            onChange={e => setCondemnedBirds(e.target.value)}
            min="0"
            inputMode="numeric"
          />
          <span className="form-hint">Birds rejected / condemned by this broker</span>
        </div>

        <div className="form-group">
          <label htmlFor="sale-notes" className="form-label">
            Notes{' '}
            <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(optional)</span>
          </label>
          <input
            id="sale-notes"
            type="text"
            className="form-input"
            placeholder="e.g. partial load, 2nd truck tomorrow"
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
            id="btn-save-sale"
            type="submit"
            className="btn btn--primary"
            disabled={loading || !saleDate || !totalWeightKg || !ratePerKg}
          >
            {loading ? <span className="spinner" /> : '🤝 Record Sale'}
          </button>
        </div>
      </form>
    </div>
  )
}
