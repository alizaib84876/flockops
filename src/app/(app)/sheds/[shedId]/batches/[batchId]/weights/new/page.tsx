'use client'

import { useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function NewWeightSamplePage() {
  const router = useRouter()
  const params = useParams()
  const shedId = params.shedId as string
  const batchId = params.batchId as string

  const today = new Date().toISOString().split('T')[0]

  const [sampleDate, setSampleDate] = useState(today)
  const [sampleSize, setSampleSize] = useState('')
  const [avgWeight, setAvgWeight] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const supabase = createClient()

    try {
      const { error: insertErr } = await supabase
        .from('weight_samples')
        .insert({
          batch_id: batchId,
          sample_date: sampleDate,
          sample_size: parseInt(sampleSize, 10),
          avg_weight_g: parseFloat(avgWeight),
        })

      if (insertErr) throw insertErr

      router.push(`/sheds/${shedId}/batches/${batchId}/growth`)
      router.refresh()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save weight sample')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container" style={{ paddingTop: '16px' }}>
      <div className="page-header" style={{ padding: '0 0 24px 0' }}>
        <Link href={`/sheds/${shedId}/batches/${batchId}/growth`} className="page-header__back" id="btn-back-growth">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </Link>
        <div className="page-header__info">
          <h1 className="page-header__title">Add Weight Sample</h1>
          <p className="page-header__subtitle">Record bird weighing for this batch</p>
        </div>
      </div>

      <div className="alert-banner alert-banner--warn" style={{ marginBottom: '20px' }}>
        <span>⚖️</span>
        <span style={{ fontSize: '0.875rem' }}>
          Weigh a random sample of birds from different parts of the shed.
          Aim for at least 50–100 birds for a reliable average.
        </span>
      </div>

      <form onSubmit={handleSubmit} className="stack stack--md">
        <div className="form-group">
          <label htmlFor="weight-date" className="form-label form-label--required">
            Sample Date
          </label>
          <input
            id="weight-date"
            type="date"
            className="form-input"
            value={sampleDate}
            onChange={e => setSampleDate(e.target.value)}
            required
            max={today}
          />
        </div>

        <div className="form-group">
          <label htmlFor="weight-sample-size" className="form-label form-label--required">
            Sample Size (birds weighed)
          </label>
          <input
            id="weight-sample-size"
            type="number"
            className="form-input"
            placeholder="e.g. 100"
            value={sampleSize}
            onChange={e => setSampleSize(e.target.value)}
            required
            min="1"
            inputMode="numeric"
          />
          <span className="form-hint">
            How many individual birds were weighed in this sample
          </span>
        </div>

        <div className="form-group">
          <label htmlFor="weight-avg" className="form-label form-label--required">
            Average Weight
            <span style={{ color: 'var(--text-muted)', fontWeight: 400, marginLeft: '4px', fontSize: '0.8125rem' }}>(grams/bird)</span>
          </label>
          <input
            id="weight-avg"
            type="number"
            className="form-input"
            placeholder="e.g. 1450"
            value={avgWeight}
            onChange={e => setAvgWeight(e.target.value)}
            required
            min="1"
            step="1"
            inputMode="numeric"
          />
          <span className="form-hint">
            Total weight of all sampled birds ÷ number of birds weighed, in grams
          </span>
        </div>

        {error && (
          <div className="alert-banner alert-banner--error" role="alert">
            <span>⚠️</span>
            <span>{error}</span>
          </div>
        )}

        <div style={{ paddingTop: '8px' }}>
          <button
            id="btn-save-weight"
            type="submit"
            className="btn btn--primary"
            disabled={loading || !sampleDate || !sampleSize || !avgWeight}
          >
            {loading ? <span className="spinner" /> : '⚖️ Save Weight Sample'}
          </button>
        </div>
      </form>
    </div>
  )
}
