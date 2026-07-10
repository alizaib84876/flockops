'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function NewFarmPage() {
  const router = useRouter()
  const [farmName, setFarmName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const supabase = createClient()

    try {
      const { data: { user }, error: authErr } = await supabase.auth.getUser()
      if (authErr || !user) throw new Error('Not authenticated')

      // Create the farm
      const { data: farm, error: farmErr } = await supabase
        .from('farms')
        .insert({
          name: farmName.trim(),
          owner_user_id: user.id,
          subscription_tier: 'free',
          subscription_status: 'trialing',
        })
        .select('id')
        .single()

      if (farmErr) throw farmErr

      // Link the user to the farm
      await supabase
        .from('users')
        .update({ farm_id: farm.id, role: 'owner' })
        .eq('id', user.id)

      // Also create a farm_members entry
      await supabase
        .from('farm_members')
        .insert({
          farm_id: farm.id,
          user_id: user.id,
          role: 'owner',
          assigned_shed_ids: [],
        })

      router.push('/sheds/new')
      router.refresh()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create farm')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container" style={{ paddingTop: '16px' }}>
      <div className="page-header" style={{ padding: '0 0 24px 0' }}>
        <Link href="/dashboard" className="page-header__back" id="btn-back-dashboard">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </Link>
        <div className="page-header__info">
          <h1 className="page-header__title">Create Farm</h1>
          <p className="page-header__subtitle">Set up your farm profile</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="stack stack--md">
        <div className="form-group">
          <label htmlFor="farm-name" className="form-label form-label--required">Farm Name</label>
          <input
            id="farm-name"
            type="text"
            className="form-input"
            placeholder="e.g. Hassan Poultry Farm"
            value={farmName}
            onChange={e => setFarmName(e.target.value)}
            required
            autoFocus
          />
        </div>

        {error && (
          <div className="alert-banner alert-banner--error" role="alert">
            <span>⚠️</span>
            <span>{error}</span>
          </div>
        )}

        <button
          id="btn-create-farm-submit"
          type="submit"
          className="btn btn--primary"
          disabled={loading || !farmName}
        >
          {loading ? <span className="spinner" /> : 'Create Farm'}
        </button>
      </form>
    </div>
  )
}
