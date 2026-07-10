'use client'

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
} from 'recharts'
import { buildChartData } from '@/lib/breedStandards'
import styles from './GrowthChart.module.css'

interface Props {
  breed: string
  dayOfCycle: number
  weightSamples: { day: number; avgWeightG: number }[]
  hasStandard: boolean
}

interface TooltipPayload {
  name: string
  value: number
  color: string
}

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: TooltipPayload[]
  label?: number
}) {
  if (!active || !payload?.length) return null
  return (
    <div className={styles.tooltip}>
      <p className={styles.tooltipDay}>Day {label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color, margin: '2px 0', fontSize: '0.875rem', fontWeight: 600 }}>
          {p.name}: {p.value.toLocaleString()} g
        </p>
      ))}
    </div>
  )
}

export default function GrowthChart({ breed, dayOfCycle, weightSamples, hasStandard }: Props) {
  const data = buildChartData(breed, dayOfCycle, weightSamples)
  const hasActual = weightSamples.length > 0

  if (!hasActual && !hasStandard) {
    return (
      <div className={styles.empty}>
        <p>No weight samples yet. Add the first sample to see the growth curve.</p>
      </div>
    )
  }

  return (
    <div className={styles.chartWrap}>
      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="rgba(255,255,255,0.06)"
          />
          <XAxis
            dataKey="day"
            stroke="var(--text-muted)"
            tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
            label={{ value: 'Day', position: 'insideBottomRight', offset: -4, fill: 'var(--text-muted)', fontSize: 11 }}
          />
          <YAxis
            stroke="var(--text-muted)"
            tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
            tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v)}
            unit="g"
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            wrapperStyle={{ fontSize: '0.8125rem', paddingTop: '8px', color: 'var(--text-secondary)' }}
          />
          {/* Today marker */}
          <ReferenceLine
            x={dayOfCycle}
            stroke="rgba(251,191,36,0.4)"
            strokeDasharray="4 4"
            label={{ value: 'Today', position: 'top', fill: 'var(--amber-400)', fontSize: 10 }}
          />
          {/* Standard curve */}
          {hasStandard && (
            <Line
              type="monotone"
              dataKey="standard"
              name={`${breed} Standard`}
              stroke="rgba(34,197,94,0.45)"
              strokeWidth={2}
              strokeDasharray="5 3"
              dot={false}
              activeDot={{ r: 4, fill: 'var(--green-400)' }}
              connectNulls={false}
            />
          )}
          {/* Actual samples */}
          {hasActual && (
            <Line
              type="monotone"
              dataKey="actual"
              name="Actual Weight"
              stroke="#60a5fa"
              strokeWidth={2.5}
              dot={{ r: 5, fill: '#60a5fa', stroke: 'var(--bg-card)', strokeWidth: 2 }}
              activeDot={{ r: 6, fill: '#93c5fd' }}
              connectNulls={false}
            />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
