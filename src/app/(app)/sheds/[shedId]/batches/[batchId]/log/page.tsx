'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import styles from './log.module.css'

interface BatchInfo {
  id: string
  breed: string
  starting_bird_count: number
  placement_date: string
  shed_id: string
}

interface ExistingLog {
  id: string
  mortality_count: number
  feed_given_kg: number
  feed_stock_remaining_kg: number
  water_consumption_l: number | null
  temperature_c: number | null
  humidity_pct: number | null
  notes: string | null
}

interface CumulativeStats {
  totalMortality: number
  totalFeed: number
  daysLogged: number
}

const PENDING_LOG_PREFIX = 'flockops_pending_log_'

function getPendingKey(batchId: string, date: string) {
  return `${PENDING_LOG_PREFIX}${batchId}_${date}`
}

function todayISO() {
  return new Date().toISOString().split('T')[0]
}

// NumericStepper: large touch-target number input with +/- buttons
function NumericStepper({
  id,
  label,
  value,
  onChange,
  required,
  step = 1,
  min = 0,
  unit,
  hint,
}: {
  id: string
  label: string
  value: string
  onChange: (v: string) => void
  required?: boolean
  step?: number
  min?: number
  unit?: string
  hint?: string
}) {
  function nudge(delta: number) {
    const current = parseFloat(value) || 0
    const next = Math.max(min, parseFloat((current + delta).toFixed(2)))
    onChange(String(next))
  }

  return (
    <div className="form-group">
      <label htmlFor={id} className={`form-label${required ? ' form-label--required' : ''}`}>
        {label}{unit ? <span className={styles.unit}>{unit}</span> : null}
      </label>
      <div className={styles.stepperRow}>
        <button
          type="button"
          className={styles.stepBtn}
          onClick={() => nudge(-step)}
          aria-label={`Decrease ${label}`}
          id={`${id}-dec`}
        >−</button>
        <input
          id={id}
          type="number"
          className={`form-input ${styles.stepperInput}`}
          value={value}
          onChange={e => onChange(e.target.value)}
          required={required}
          min={min}
          step={step}
          inputMode="decimal"
        />
        <button
          type="button"
          className={styles.stepBtn}
          onClick={() => nudge(step)}
          aria-label={`Increase ${label}`}
          id={`${id}-inc`}
        >+</button>
      </div>
      {hint && <span className="form-hint">{hint}</span>}
    </div>
  )
}

export default function DailyLogPage() {
  const router = useRouter()
  const params = useParams()
  const shedId = params.shedId as string
  const batchId = params.batchId as string

  const today = todayISO()

  // State
  const [batch, setBatch] = useState<BatchInfo | null>(null)
  const [existingLog, setExistingLog] = useState<ExistingLog | null>(null)
  const [cumulative, setCumulative] = useState<CumulativeStats>({ totalMortality: 0, totalFeed: 0, daysLogged: 0 })
  const [isEditing, setIsEditing] = useState(false)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [isPending, setIsPending] = useState(false)
  const [hasPendingLog, setHasPendingLog] = useState(false)
  const [syncing, setSyncing] = useState(false)

  // Form fields
  const [mortality, setMortality] = useState('0')
  const [feedGiven, setFeedGiven] = useState('')
  const [feedStock, setFeedStock] = useState('')
  const [water, setWater] = useState('')
  const [temp, setTemp] = useState('')
  const [humidity, setHumidity] = useState('')
  const [notes, setNotes] = useState('')

  const userId = typeof window !== 'undefined'
    ? localStorage.getItem('flockops_user_id')
    : null

  // Load batch info + existing log + cumulative stats
  const loadData = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()

    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        localStorage.setItem('flockops_user_id', user.id)
      }

      // Fetch batch
      const { data: batchData } = await supabase
        .from('batches')
        .select('id, breed, starting_bird_count, placement_date, shed_id')
        .eq('id', batchId)
        .single()
      if (batchData) setBatch(batchData as BatchInfo)

      // Check for today's existing log
      const { data: todayLog } = await supabase
        .from('daily_logs')
        .select('id, mortality_count, feed_given_kg, feed_stock_remaining_kg, water_consumption_l, temperature_c, humidity_pct, notes')
        .eq('batch_id', batchId)
        .eq('log_date', today)
        .maybeSingle()

      if (todayLog) {
        setExistingLog(todayLog as ExistingLog)
        // Pre-fill form for editing
        setMortality(String(todayLog.mortality_count))
        setFeedGiven(String(todayLog.feed_given_kg))
        setFeedStock(String(todayLog.feed_stock_remaining_kg))
        setWater(todayLog.water_consumption_l != null ? String(todayLog.water_consumption_l) : '')
        setTemp(todayLog.temperature_c != null ? String(todayLog.temperature_c) : '')
        setHumidity(todayLog.humidity_pct != null ? String(todayLog.humidity_pct) : '')
        setNotes(todayLog.notes ?? '')
      }

      // Fetch cumulative stats (all logs for this batch)
      const { data: allLogs } = await supabase
        .from('daily_logs')
        .select('mortality_count, feed_given_kg')
        .eq('batch_id', batchId)

      if (allLogs) {
        const stats = allLogs.reduce(
          (acc, l) => ({
            totalMortality: acc.totalMortality + Number(l.mortality_count),
            totalFeed: acc.totalFeed + Number(l.feed_given_kg),
            daysLogged: acc.daysLogged + 1,
          }),
          { totalMortality: 0, totalFeed: 0, daysLogged: 0 }
        )
        setCumulative(stats)
      }

      // Check for pending offline log
      const pendingKey = getPendingKey(batchId, today)
      const pending = localStorage.getItem(pendingKey)
      if (pending) setHasPendingLog(true)
    } catch {
      // Network failure — check for pending log
      const pendingKey = getPendingKey(batchId, today)
      const pending = localStorage.getItem(pendingKey)
      if (pending) {
        setHasPendingLog(true)
        const parsed = JSON.parse(pending)
        setMortality(String(parsed.mortality_count ?? '0'))
        setFeedGiven(String(parsed.feed_given_kg ?? ''))
        setFeedStock(String(parsed.feed_stock_remaining_kg ?? ''))
        setWater(parsed.water_consumption_l != null ? String(parsed.water_consumption_l) : '')
        setTemp(parsed.temperature_c != null ? String(parsed.temperature_c) : '')
        setHumidity(parsed.humidity_pct != null ? String(parsed.humidity_pct) : '')
        setNotes(parsed.notes ?? '')
      }
    } finally {
      setLoading(false)
    }
  }, [batchId, today])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Sync pending log when back online
  async function syncPendingLog() {
    const pendingKey = getPendingKey(batchId, today)
    const pending = localStorage.getItem(pendingKey)
    if (!pending) return

    setSyncing(true)
    const supabase = createClient()

    try {
      const payload = JSON.parse(pending)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const { error: syncErr } = await supabase
        .from('daily_logs')
        .upsert({ ...payload, logged_by_user_id: user.id }, { onConflict: 'batch_id,log_date' })

      if (syncErr) throw syncErr

      localStorage.removeItem(pendingKey)
      setHasPendingLog(false)
      setSuccess(true)
      await loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sync failed')
    } finally {
      setSyncing(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError('')

    const payload = {
      batch_id: batchId,
      log_date: today,
      mortality_count: parseInt(mortality, 10) || 0,
      feed_given_kg: parseFloat(feedGiven),
      feed_stock_remaining_kg: parseFloat(feedStock),
      water_consumption_l: water ? parseFloat(water) : null,
      temperature_c: temp ? parseFloat(temp) : null,
      humidity_pct: humidity ? parseFloat(humidity) : null,
      notes: notes.trim() || null,
    }

    const supabase = createClient()

    try {
      const { data: { user }, error: authErr } = await supabase.auth.getUser()
      if (authErr || !user) throw new Error('Not authenticated')

      let dbErr: unknown = null

      if (existingLog && !isEditing) {
        // Shouldn't reach here, but guard anyway
        throw new Error('Log already exists')
      } else if (existingLog && isEditing) {
        // Record edit history for changed fields
        const editRecords = []
        const fields: Array<{ key: keyof typeof payload; dbKey: string }> = [
          { key: 'mortality_count', dbKey: 'mortality_count' },
          { key: 'feed_given_kg', dbKey: 'feed_given_kg' },
          { key: 'feed_stock_remaining_kg', dbKey: 'feed_stock_remaining_kg' },
          { key: 'water_consumption_l', dbKey: 'water_consumption_l' },
          { key: 'temperature_c', dbKey: 'temperature_c' },
          { key: 'humidity_pct', dbKey: 'humidity_pct' },
          { key: 'notes', dbKey: 'notes' },
        ]
        for (const f of fields) {
          const oldVal = existingLog[f.key as keyof ExistingLog]
          const newVal = payload[f.key]
          if (String(oldVal ?? '') !== String(newVal ?? '')) {
            editRecords.push({
              daily_log_id: existingLog.id,
              edited_by_user_id: user.id,
              field_name: f.dbKey,
              old_value: oldVal != null ? String(oldVal) : null,
              new_value: newVal != null ? String(newVal) : null,
            })
          }
        }

        const { error: updateErr } = await supabase
          .from('daily_logs')
          .update({ ...payload, logged_by_user_id: user.id })
          .eq('id', existingLog.id)

        dbErr = updateErr

        if (!updateErr && editRecords.length > 0) {
          await supabase.from('daily_log_edits').insert(editRecords)
        }
      } else {
        // New log insert
        const { error: insertErr } = await supabase
          .from('daily_logs')
          .insert({ ...payload, logged_by_user_id: user.id })

        dbErr = insertErr
      }

      if (dbErr) throw dbErr

      // Clear any pending offline log
      localStorage.removeItem(getPendingKey(batchId, today))
      setHasPendingLog(false)
      setIsPending(false)
      setSuccess(true)
      setIsEditing(false)
      await loadData()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save'

      // Detect network failure → store offline
      if (msg.toLowerCase().includes('network') || msg.toLowerCase().includes('fetch') || msg.toLowerCase().includes('failed')) {
        localStorage.setItem(getPendingKey(batchId, today), JSON.stringify(payload))
        setHasPendingLog(true)
        setIsPending(true)
        setSuccess(true)
      } else {
        setError(msg)
      }
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <span className="spinner" style={{ width: '32px', height: '32px', borderWidth: '3px' }} />
      </div>
    )
  }

  const dayOfCycle = batch
    ? Math.max(0, Math.floor((new Date().getTime() - new Date(batch.placement_date).getTime()) / (1000 * 60 * 60 * 24))) + 1
    : 0

  const mortalityPct = batch && cumulative.totalMortality > 0
    ? ((cumulative.totalMortality / batch.starting_bird_count) * 100).toFixed(2)
    : '0.00'

  const alreadySubmittedToday = !!existingLog && !isEditing

  return (
    <div className="container" style={{ paddingTop: '16px', paddingBottom: '40px' }}>
      {/* Header */}
      <div className="page-header" style={{ padding: '0 0 16px 0' }}>
        <Link href={`/sheds/${shedId}/batches/${batchId}`} className="page-header__back" id="btn-back-batch">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </Link>
        <div className="page-header__info">
          <h1 className="page-header__title">Daily Log</h1>
          <p className="page-header__subtitle">
            Day {dayOfCycle} · {new Date(today).toLocaleDateString('en-PK', { weekday: 'short', day: 'numeric', month: 'short' })}
          </p>
        </div>
        {alreadySubmittedToday && (
          <button
            className="btn btn--ghost btn--sm"
            onClick={() => setIsEditing(true)}
            type="button"
            id="btn-edit-log"
            style={{ width: 'auto', flexShrink: 0 }}
          >
            Edit
          </button>
        )}
      </div>

      {/* Pending sync banner */}
      {hasPendingLog && (
        <div className={styles.pendingBanner}>
          <span>⏳</span>
          <span>Log saved offline — waiting for connection</span>
          <button
            className={styles.syncBtn}
            onClick={syncPendingLog}
            disabled={syncing}
            id="btn-sync-now"
            type="button"
          >
            {syncing ? <span className="spinner" style={{ width: '14px', height: '14px', borderWidth: '2px' }} /> : 'Sync now'}
          </button>
        </div>
      )}

      {/* Success banner */}
      {success && !error && (
        <div className="alert-banner alert-banner--success" style={{ marginBottom: '16px' }}>
          <span>✅</span>
          <span>
            {isPending ? 'Saved offline — will sync when connected' : 'Log saved successfully'}
          </span>
        </div>
      )}

      {/* Running totals (always visible) */}
      <div style={{ marginBottom: '20px' }}>
        <p className="section-title">This Batch — Running Totals</p>
        <div className="stat-grid">
          <div className="stat-card stat-card--accent">
            <div className="stat-card__label">Days Logged</div>
            <div className="stat-card__value">{cumulative.daysLogged}</div>
            <div className="stat-card__sub">of Day {dayOfCycle}</div>
          </div>
          <div className={`stat-card ${parseFloat(mortalityPct) > 3 ? 'stat-card--danger' : ''}`}>
            <div className="stat-card__label">Total Mortality</div>
            <div className="stat-card__value">{cumulative.totalMortality.toLocaleString()}</div>
            <div className="stat-card__sub">{mortalityPct}% of flock</div>
          </div>
          <div className="stat-card">
            <div className="stat-card__label">Total Feed</div>
            <div className="stat-card__value">{cumulative.totalFeed.toFixed(0)}</div>
            <div className="stat-card__sub">kg consumed</div>
          </div>
          <div className="stat-card">
            <div className="stat-card__label">Birds Alive</div>
            <div className="stat-card__value">
              {batch ? (batch.starting_bird_count - cumulative.totalMortality).toLocaleString() : '—'}
            </div>
            <div className="stat-card__sub">est. current</div>
          </div>
        </div>
      </div>

      {/* Already submitted today — show read-only summary */}
      {alreadySubmittedToday && existingLog && (
        <div style={{ marginBottom: '20px' }}>
          <p className="section-title">Today&apos;s Log ✓</p>
          <div className="card" style={{ borderColor: 'rgba(34,197,94,0.2)' }}>
            <div className={styles.logSummaryGrid}>
              <div className={styles.logSummaryItem}>
                <span className={styles.logSummaryLabel}>Mortality</span>
                <span className={`${styles.logSummaryValue} ${existingLog.mortality_count > 0 ? styles.danger : styles.safe}`}>
                  {existingLog.mortality_count}
                </span>
              </div>
              <div className={styles.logSummaryItem}>
                <span className={styles.logSummaryLabel}>Feed Given</span>
                <span className={styles.logSummaryValue}>{existingLog.feed_given_kg} kg</span>
              </div>
              <div className={styles.logSummaryItem}>
                <span className={styles.logSummaryLabel}>Feed Stock</span>
                <span className={styles.logSummaryValue}>{existingLog.feed_stock_remaining_kg} kg</span>
              </div>
              {existingLog.water_consumption_l != null && (
                <div className={styles.logSummaryItem}>
                  <span className={styles.logSummaryLabel}>Water</span>
                  <span className={styles.logSummaryValue}>{existingLog.water_consumption_l} L</span>
                </div>
              )}
              {existingLog.temperature_c != null && (
                <div className={styles.logSummaryItem}>
                  <span className={styles.logSummaryLabel}>Temp</span>
                  <span className={styles.logSummaryValue}>{existingLog.temperature_c}°C</span>
                </div>
              )}
              {existingLog.humidity_pct != null && (
                <div className={styles.logSummaryItem}>
                  <span className={styles.logSummaryLabel}>Humidity</span>
                  <span className={styles.logSummaryValue}>{existingLog.humidity_pct}%</span>
                </div>
              )}
            </div>
            {existingLog.notes && (
              <p style={{ marginTop: '12px', fontSize: '0.875rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                &ldquo;{existingLog.notes}&rdquo;
              </p>
            )}
          </div>
          <button
            className="btn btn--secondary"
            onClick={() => setIsEditing(true)}
            type="button"
            id="btn-edit-todays-log"
            style={{ marginTop: '12px' }}
          >
            ✏️ Edit Today&apos;s Log
          </button>
        </div>
      )}

      {/* Log form — show if no log yet OR editing */}
      {(!alreadySubmittedToday || isEditing) && (
        <form onSubmit={handleSubmit} className="stack stack--md" noValidate>
          {isEditing && (
            <div className="alert-banner alert-banner--warn">
              <span>✏️</span>
              <span style={{ fontSize: '0.875rem' }}>
                Editing an existing log. Changes are recorded in edit history.
              </span>
            </div>
          )}

          <p className="section-title" style={{ marginBottom: 0 }}>
            Required Fields
          </p>

          <NumericStepper
            id="log-mortality"
            label="Mortality Count"
            value={mortality}
            onChange={setMortality}
            required
            step={1}
            min={0}
            hint="Number of birds that died today"
          />

          <NumericStepper
            id="log-feed-given"
            label="Feed Given"
            value={feedGiven}
            onChange={setFeedGiven}
            required
            step={50}
            min={0}
            unit="kg"
            hint="Total feed given to this shed today"
          />

          <NumericStepper
            id="log-feed-stock"
            label="Feed Stock Remaining"
            value={feedStock}
            onChange={setFeedStock}
            required
            step={50}
            min={0}
            unit="kg"
            hint="Feed bags remaining in shed store"
          />

          <div className="divider" style={{ margin: '4px 0' }} />
          <p className="section-title" style={{ marginBottom: 0 }}>
            Optional Fields
          </p>

          <NumericStepper
            id="log-water"
            label="Water Consumption"
            value={water}
            onChange={setWater}
            step={100}
            min={0}
            unit="L"
          />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div className="form-group">
              <label htmlFor="log-temp" className="form-label">
                Temperature <span className={styles.unit}>°C</span>
              </label>
              <input
                id="log-temp"
                type="number"
                className="form-input"
                placeholder="e.g. 28"
                value={temp}
                onChange={e => setTemp(e.target.value)}
                step="0.5"
                inputMode="decimal"
              />
            </div>
            <div className="form-group">
              <label htmlFor="log-humidity" className="form-label">
                Humidity <span className={styles.unit}>%</span>
              </label>
              <input
                id="log-humidity"
                type="number"
                className="form-input"
                placeholder="e.g. 65"
                value={humidity}
                onChange={e => setHumidity(e.target.value)}
                min="0"
                max="100"
                step="1"
                inputMode="numeric"
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="log-notes" className="form-label">Notes</label>
            <textarea
              id="log-notes"
              className="form-input"
              placeholder="Any observations, health concerns, medication given…"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={3}
              style={{ resize: 'vertical', minHeight: '80px' }}
            />
          </div>

          {error && (
            <div className="alert-banner alert-banner--error" role="alert">
              <span>⚠️</span>
              <span>{error}</span>
            </div>
          )}

          <div className="stack stack--sm" style={{ paddingTop: '8px' }}>
            <button
              id="btn-submit-log"
              type="submit"
              className="btn btn--primary"
              disabled={submitting || !feedGiven || !feedStock}
            >
              {submitting
                ? <span className="spinner" />
                : isEditing ? '💾 Save Changes' : '✅ Submit Log'
              }
            </button>
            {isEditing && (
              <button
                type="button"
                className="btn btn--secondary"
                onClick={() => { setIsEditing(false); setError('') }}
                id="btn-cancel-edit"
              >
                Cancel
              </button>
            )}
          </div>
        </form>
      )}
    </div>
  )
}
