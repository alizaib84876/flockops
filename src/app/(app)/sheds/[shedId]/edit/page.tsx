'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function EditShedPage() {
  const router = useRouter()
  const params = useParams()
  const shedId = params.shedId as string

  const [name, setName] = useState('')
  const [capacity, setCapacity] = useState('')
  const [location, setLocation] = useState('')
  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const supabase = createClient()
    supabase
      .from('sheds')
      .select('name, capacity, location')
      .eq('id', shedId)
      .single()
      .then(({ data }) => {
        if (data) {
          setName(data.name)
          setCapacity(String(data.capacity))
          setLocation(data.location ?? '')
        }
        setFetching(false)
      })
  }, [shedId])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const supabase = createClient()

    try {
      const { error: updateErr } = await supabase
        .from('sheds')
        .update({
          name: name.trim(),
          capacity: parseInt(capacity, 10),
          location: location.trim() || null,
        })
        .eq('id', shedId)

      if (updateErr) throw updateErr

      router.push(`/sheds/${shedId}`)
      router.refresh()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update shed')
    } finally {
      setLoading(false)
    }
  }

  if (fetching) {
    return (
      <div className="container" style={{ paddingTop: '40px', display: 'flex', justifyContent: 'center' }}>
        <span className="spinner" />
      </div>
    )
  }

  return (
    <div className="container" style={{ paddingTop: '16px' }}>
      <div className="page-header" style={{ padding: '0 0 24px 0' }}>
        <Link href={`/sheds/${shedId}`} className="page-header__back" id="btn-back-shed-edit">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </Link>
        <div className="page-header__info">
          <h1 className="page-header__title">Edit Shed</h1>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="stack stack--md">
        <div className="form-group">
          <label htmlFor="shed-name-edit" className="form-label form-label--required">Shed Name</label>
          <input
            id="shed-name-edit"
            type="text"
            className="form-input"
            value={name}
            onChange={e => setName(e.target.value)}
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="shed-capacity-edit" className="form-label form-label--required">Capacity (birds)</label>
          <input
            id="shed-capacity-edit"
            type="number"
            className="form-input"
            value={capacity}
            onChange={e => setCapacity(e.target.value)}
            required
            min="1"
            inputMode="numeric"
          />
        </div>

        <div className="form-group">
          <label htmlFor="shed-location-edit" className="form-label">Location (optional)</label>
          <input
            id="shed-location-edit"
            type="text"
            className="form-input"
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

        <button
          id="btn-save-shed-edit"
          type="submit"
          className="btn btn--primary"
          disabled={loading || !name || !capacity}
        >
          {loading ? <span className="spinner" /> : 'Save Changes'}
        </button>
      </form>
    </div>
  )
}
