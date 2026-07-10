'use client'

import dynamic from 'next/dynamic'

// recharts uses browser-only APIs — must be dynamically imported from a Client Component
const GrowthChart = dynamic(() => import('@/components/GrowthChart'), {
  ssr: false,
  loading: () => (
    <div style={{
      height: '260px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--bg-card)',
      borderRadius: 'var(--radius-lg)',
      border: '1px solid var(--border-subtle)',
    }}>
      <span className="spinner" />
    </div>
  ),
})

export default function GrowthChartClient(props: {
  breed: string
  dayOfCycle: number
  weightSamples: { day: number; avgWeightG: number }[]
  hasStandard: boolean
}) {
  return <GrowthChart {...props} />
}
