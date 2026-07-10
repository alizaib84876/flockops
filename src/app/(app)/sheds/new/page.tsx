'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function NewShedPage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [capacity, setCapacity] = useState('')
  const [location, setLocation] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const supabase = createClient()

    try {
      // Get current user and their farm_id
      const { data: { user }, error: userErr } = await supabase.auth.getUser()
      if (userErr || !user) throw new Error('Not authenticated')

      const { data: userRow, error: rowErr } = await supabase
        .from('users')
        .select('farm_id')
        .eq('id', user.id)
        .single()

      if (rowErr || !userRow?.farm_id) {
        throw new Error('No farm found. Please create a farm first in Settings.')
      }

      const { data: shed, error: shedErr } = await supabase
        .from('sheds')
        .insert({
          farm_id: userRow.farm_id,
          name: name.trim(),
          capacity: parseInt(capacity, 10),
          location: location.trim() || null,
        })
        .select('id')
        .single()

      if (shedErr) throw shedErr

      router.push(`/sheds/${shed.id}`)
      router.refresh()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create shed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container" style={{ paddingTop: '16px' }}>
      {/* Header */}
      <div className="page-header" style={{ padding: '0 0 24px 0' }}>
        <Link href="/sheds" className="page-header__back" id="btn-back-sheds">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </Link>
        <div className="page-header__info">
          <h1 className="page-header__title">New Shed</h1>
          <p className="page-header__subtitle">Add a broiler shed to your farm</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="stack stack--md">
        <div className="form-group">
          <label htmlFor="shed-name" className="form-label form-label--required">
            Shed Name
          </label>
          <input
            id="shed-name"
            type="text"
            className="form-input"
            placeholder="e.g. Shed A, Shed 1, North House"
            value={name}
            onChange={e => setName(e.target.value)}
            required
            autoFocus
          />
          <span className="form-hint">A short, unique name you use to identify this shed</span>
        </div>

        <div className="form-group">
          <label htmlFor="shed-capacity" className="form-label form-label--required">
            Capacity (birds)
          </label>
          <input
            id="shed-capacity"
            type="number"
            className="form-input"
            placeholder="e.g. 10000"
            value={capacity}
            onChange={e => setCapacity(e.target.value)}
            required
            min="1"
            inputMode="numeric"
          />
          <span className="form-hint">Maximum number of birds this shed can house</span>
        </div>

        <div className="form-group">
          <label htmlFor="shed-location" className="form-label">
            Location <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(optional)</span>
          </label>
          <input
            id="shed-location"
            type="text"
            className="form-input"
            placeholder="e.g. North side of farm, Block 2"
            value={location}
            onChange={e => setLocation(e.target.value)}
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
            id="btn-save-shed"
            type="submit"
            className="btn btn--primary"
            disabled={loading || !name || !capacity}
          >
            {loading ? <span className="spinner" /> : 'Save Shed'}
          </button>
        </div>
      </form>
    </div>
  )
}
