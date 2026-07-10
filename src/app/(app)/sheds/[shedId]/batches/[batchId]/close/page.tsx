'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function CloseBatchPage() {
  const router = useRouter()
  const params = useParams()
  const shedId = params.shedId as string
  const batchId = params.batchId as string

  const today = new Date().toISOString().split('T')[0]

  const [batchBreed, setBatchBreed] = useState('')
  const [existingSale, setExistingSale] = useState<{ id: string } | null>(null)
  const [saleDate, setSaleDate] = useState(today)
  const [buyerName, setBuyerName] = useState('')
  const [totalWeightKg, setTotalWeightKg] = useState('')
  const [ratePerKg, setRatePerKg] = useState('')
  const [condemnedBirds, setCondemnedBirds] = useState('0')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(true)
  const [error, setError] = useState('')
  const [confirmClose, setConfirmClose] = useState(false)

  const totalAmount = totalWeightKg && ratePerKg
    ? (parseFloat(totalWeightKg) * parseFloat(ratePerKg)).toFixed(0)
    : ''

  useEffect(() => {
    const supabase = createClient()
    Promise.all([
      supabase.from('batches').select('breed').eq('id', batchId).single(),
      supabase.from('sales').select('id').eq('batch_id', batchId).maybeSingle(),
    ]).then(([batchRes, saleRes]) => {
      if (batchRes.data) setBatchBreed(batchRes.data.breed)
      if (saleRes.data) setExistingSale(saleRes.data)
      setFetching(false)
    })
  }, [batchId])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!confirmClose) {
      setConfirmClose(true)
      return
    }
    setLoading(true)
    setError('')

    const supabase = createClient()

    try {
      // Upsert the sale record
      const { error: saleErr } = await supabase
        .from('sales')
        .upsert({
          ...(existingSale ? { id: existingSale.id } : {}),
          batch_id: batchId,
          sale_date: saleDate,
          buyer_name: buyerName.trim() || null,
          total_weight_kg: parseFloat(totalWeightKg),
          rate_per_kg: parseFloat(ratePerKg),
          condemned_birds_count: parseInt(condemnedBirds, 10) || 0,
          total_amount: parseFloat(totalAmount),
          notes: notes.trim() || null,
        })

      if (saleErr) throw saleErr

      // Mark batch as harvested
      const { error: batchErr } = await supabase
        .from('batches')
        .update({ status: 'harvested' })
        .eq('id', batchId)

      if (batchErr) throw batchErr

      router.push(`/sheds/${shedId}/batches/${batchId}/financials`)
      router.refresh()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to record sale')
      setConfirmClose(false)
    } finally {
      setLoading(false)
    }
  }

  if (fetching) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', paddingTop: '40px' }}>
        <span className="spinner" style={{ width: '32px', height: '32px', borderWidth: '3px' }} />
      </div>
    )
  }

  return (
    <div className="container" style={{ paddingTop: '16px', paddingBottom: '32px' }}>
      <div className="page-header" style={{ padding: '0 0 24px 0' }}>
        <Link href={`/sheds/${shedId}/batches/${batchId}`} className="page-header__back" id="btn-back-batch-close">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </Link>
        <div className="page-header__info">
          <h1 className="page-header__title">Close Batch</h1>
          <p className="page-header__subtitle">{batchBreed} — Record harvest & sale</p>
        </div>
      </div>

      <div className="alert-banner alert-banner--warn" style={{ marginBottom: '20px' }}>
        <span>🏁</span>
        <span style={{ fontSize: '0.875rem' }}>
          Closing a batch marks it as harvested and moves it to history. The batch will no longer accept daily logs.
        </span>
      </div>

      <form onSubmit={handleSubmit} className="stack stack--md">
        <div className="form-group">
          <label htmlFor="sale-date" className="form-label form-label--required">Sale / Harvest Date</label>
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
            Buyer Name <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(optional)</span>
          </label>
          <input
            id="buyer-name"
            type="text"
            className="form-input"
            placeholder="e.g. Al-Baraka Poultry Traders"
            value={buyerName}
            onChange={e => setBuyerName(e.target.value)}
          />
        </div>

        <div className="form-group">
          <label htmlFor="total-weight" className="form-label form-label--required">
            Total Weight Sold <span style={{ color: 'var(--text-muted)', fontWeight: 400, fontSize: '0.8125rem' }}>(kg)</span>
          </label>
          <input
            id="total-weight"
            type="number"
            className="form-input"
            placeholder="e.g. 42500"
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
            Rate per kg <span style={{ color: 'var(--text-muted)', fontWeight: 400, fontSize: '0.8125rem' }}>(PKR)</span>
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

        {/* Auto-calculated total */}
        {totalAmount && (
          <div style={{
            padding: '16px',
            background: 'var(--accent-dim)',
            border: '1px solid rgba(34,197,94,0.2)',
            borderRadius: 'var(--radius-md)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.9375rem' }}>Total Revenue</span>
            <span style={{ fontWeight: 800, fontSize: '1.375rem', color: 'var(--green-400)' }}>
              ₨ {parseInt(totalAmount).toLocaleString()}
            </span>
          </div>
        )}

        <div className="form-group">
          <label htmlFor="condemned-birds" className="form-label">
            Condemned Birds <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(optional)</span>
          </label>
          <input
            id="condemned-birds"
            type="number"
            className="form-input"
            placeholder="0"
            value={condemnedBirds}
            onChange={e => setCondemnedBirds(e.target.value)}
            min="0"
            step="1"
            inputMode="numeric"
          />
          <span className="form-hint">Birds rejected at sale (condemned/unfit)</span>
        </div>

        <div className="form-group">
          <label htmlFor="close-notes" className="form-label">
            Notes <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(optional)</span>
          </label>
          <textarea
            id="close-notes"
            className="form-input"
            placeholder="Any additional comments about this harvest…"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={2}
            style={{ resize: 'vertical' }}
          />
        </div>

        {error && (
          <div className="alert-banner alert-banner--error" role="alert">
            <span>⚠️</span>
            <span>{error}</span>
          </div>
        )}

        {confirmClose ? (
          <div className="stack stack--sm" style={{ paddingTop: '8px' }}>
            <div className="alert-banner alert-banner--error">
              <span>⚠️</span>
              <span style={{ fontSize: '0.9375rem', fontWeight: 600 }}>
                This will permanently close this batch. Are you sure?
              </span>
            </div>
            <button
              id="btn-confirm-close"
              type="submit"
              className="btn btn--primary"
              disabled={loading}
              style={{ background: 'var(--red-500, #ef4444)', borderColor: 'var(--red-500, #ef4444)' }}
            >
              {loading ? <span className="spinner" /> : '✅ Yes, Close Batch'}
            </button>
            <button
              type="button"
              className="btn btn--secondary"
              onClick={() => setConfirmClose(false)}
              id="btn-cancel-close"
            >
              Cancel
            </button>
          </div>
        ) : (
          <div style={{ paddingTop: '8px' }}>
            <button
              id="btn-close-batch-submit"
              type="submit"
              className="btn btn--primary"
              disabled={loading || !saleDate || !totalWeightKg || !ratePerKg}
            >
              🏁 Close Batch & Record Sale
            </button>
          </div>
        )}
      </form>
    </div>
  )
}
