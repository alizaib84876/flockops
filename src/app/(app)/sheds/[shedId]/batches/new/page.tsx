'use client'

import { useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

const BREEDS = [
  'Ross 308',
  'Cobb 500',
  'Hubbard Classic',
  'Arbor Acres',
  'Other',
]

export default function NewBatchPage() {
  const router = useRouter()
  const params = useParams()
  const shedId = params.shedId as string

  const today = new Date().toISOString().split('T')[0]

  const [breed, setBreed] = useState('')
  const [customBreed, setCustomBreed] = useState('')
  const [placementDate, setPlacementDate] = useState(today)
  const [birdCount, setBirdCount] = useState('')
  const [targetWeight, setTargetWeight] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const supabase = createClient()
    const finalBreed = breed === 'Other' ? customBreed.trim() : breed

    try {
      const { data: { user }, error: authErr } = await supabase.auth.getUser()
      if (authErr || !user) throw new Error('Not authenticated')

      // Check no active batch already exists for this shed
      const { data: existing } = await supabase
        .from('batches')
        .select('id')
        .eq('shed_id', shedId)
        .eq('status', 'active')
        .maybeSingle()

      if (existing) {
        throw new Error('This shed already has an active batch. Close the current batch before starting a new one.')
      }

      const { data: batch, error: batchErr } = await supabase
        .from('batches')
        .insert({
          shed_id: shedId,
          breed: finalBreed,
          placement_date: placementDate,
          starting_bird_count: parseInt(birdCount, 10),
          target_harvest_weight: targetWeight ? parseFloat(targetWeight) : null,
          status: 'active',
        })
        .select('id')
        .single()

      if (batchErr) throw batchErr

      router.push(`/sheds/${shedId}/batches/${batch.id}`)
      router.refresh()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to start batch')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container" style={{ paddingTop: '16px' }}>
      <div className="page-header" style={{ padding: '0 0 24px 0' }}>
        <Link href={`/sheds/${shedId}`} className="page-header__back" id="btn-back-shed">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </Link>
        <div className="page-header__info">
          <h1 className="page-header__title">Start New Batch</h1>
          <p className="page-header__subtitle">Record chick placement details</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="stack stack--md">
        {/* Breed */}
        <div className="form-group">
          <label htmlFor="batch-breed" className="form-label form-label--required">
            Breed
          </label>
          <select
            id="batch-breed"
            className="form-input"
            value={breed}
            onChange={e => setBreed(e.target.value)}
            required
          >
            <option value="">Select breed…</option>
            {BREEDS.map(b => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>
        </div>

        {breed === 'Other' && (
          <div className="form-group">
            <label htmlFor="batch-breed-custom" className="form-label form-label--required">
              Breed Name
            </label>
            <input
              id="batch-breed-custom"
              type="text"
              className="form-input"
              placeholder="Enter breed name"
              value={customBreed}
              onChange={e => setCustomBreed(e.target.value)}
              required
            />
          </div>
        )}

        {/* Placement Date */}
        <div className="form-group">
          <label htmlFor="batch-placement-date" className="form-label form-label--required">
            Placement Date
          </label>
          <input
            id="batch-placement-date"
            type="date"
            className="form-input"
            value={placementDate}
            onChange={e => setPlacementDate(e.target.value)}
            required
            max={today}
          />
          <span className="form-hint">Date chicks were placed in this shed</span>
        </div>

        {/* Bird Count */}
        <div className="form-group">
          <label htmlFor="batch-bird-count" className="form-label form-label--required">
            Starting Bird Count
          </label>
          <input
            id="batch-bird-count"
            type="number"
            className="form-input"
            placeholder="e.g. 10000"
            value={birdCount}
            onChange={e => setBirdCount(e.target.value)}
            required
            min="1"
            inputMode="numeric"
          />
          <span className="form-hint">Number of chicks placed on day 1 (must be accurate — all FCR and mortality % calculations depend on this)</span>
        </div>

        {/* Target Harvest Weight */}
        <div className="form-group">
          <label htmlFor="batch-target-weight" className="form-label">
            Target Harvest Weight (kg/bird){' '}
            <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(optional)</span>
          </label>
          <input
            id="batch-target-weight"
            type="number"
            className="form-input"
            placeholder="e.g. 2.5"
            value={targetWeight}
            onChange={e => setTargetWeight(e.target.value)}
            min="0.1"
            step="0.1"
            inputMode="decimal"
          />
          <span className="form-hint">Expected weight per bird at harvest, in kg</span>
        </div>

        {error && (
          <div className="alert-banner alert-banner--error" role="alert">
            <span>⚠️</span>
            <span>{error}</span>
          </div>
        )}

        {/* Warning about data accuracy */}
        <div className="alert-banner alert-banner--warn">
          <span>📌</span>
          <span style={{ fontSize: '0.875rem' }}>
            Double-check the bird count and placement date — these cannot be changed without creating an edit record, and all downstream calculations depend on them.
          </span>
        </div>

        <div style={{ paddingTop: '8px' }}>
          <button
            id="btn-start-batch-submit"
            type="submit"
            className="btn btn--primary"
            disabled={loading || !breed || (breed === 'Other' && !customBreed) || !placementDate || !birdCount}
          >
            {loading ? <span className="spinner" /> : '🐔 Start Batch'}
          </button>
        </div>
      </form>
    </div>
  )
}
