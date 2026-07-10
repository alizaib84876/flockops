'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface Props {
  batchId: string
  shedId: string
}

export default function CloseBatchButton({ batchId, shedId }: Props) {
  const router = useRouter()
  const [step, setStep] = useState<'idle' | 'confirm' | 'loading'>('idle')
  const [error, setError] = useState('')

  async function closeBatch() {
    setStep('loading')
    setError('')
    const supabase = createClient()

    try {
      const { error: err } = await supabase
        .from('batches')
        .update({ status: 'harvested' })
        .eq('id', batchId)

      if (err) throw err

      router.push(`/sheds/${shedId}/batches/${batchId}`)
      router.refresh()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to close batch')
      setStep('confirm')
    }
  }

  if (step === 'idle') {
    return (
      <button
        id="btn-close-batch-confirm"
        type="button"
        className="btn btn--secondary"
        onClick={() => setStep('confirm')}
      >
        🏁 Close Batch
      </button>
    )
  }

  if (step === 'confirm') {
    return (
      <div className="stack stack--sm">
        {error && (
          <div className="alert-banner alert-banner--error">
            <span>⚠️</span>
            <span>{error}</span>
          </div>
        )}
        <div className="alert-banner alert-banner--error">
          <span>⚠️</span>
          <span style={{ fontWeight: 600 }}>This batch will be permanently closed. No more daily logs or sales can be added. Continue?</span>
        </div>
        <button
          id="btn-close-batch-yes"
          type="button"
          className="btn btn--primary"
          style={{ background: '#ef4444', borderColor: '#ef4444' }}
          onClick={closeBatch}
        >
          ✅ Yes, Close Batch
        </button>
        <button
          id="btn-close-batch-cancel"
          type="button"
          className="btn btn--secondary"
          onClick={() => { setStep('idle'); setError('') }}
        >
          Cancel
        </button>
      </div>
    )
  }

  return (
    <button className="btn btn--secondary" disabled type="button">
      <span className="spinner" />
    </button>
  )
}
