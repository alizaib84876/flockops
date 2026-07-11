import { createClient } from '@/lib/supabase/server'

/**
 * Returns the number of active alerts for the current user's farm.
 * Used by the app shell to show a badge on the Alerts nav tab.
 * Returns 0 on any error so it never breaks the layout.
 */
export async function getAlertCount(): Promise<number> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return 0

    const { data: userData } = await supabase
      .from('users')
      .select('farm_id')
      .eq('id', user.id)
      .single()
    const farmId = (userData as { farm_id: string | null } | null)?.farm_id
    if (!farmId) return 0

    const { data: shedsData } = await supabase
      .from('sheds')
      .select('id')
      .eq('farm_id', farmId)
    const shedIds = (shedsData ?? []).map((s: { id: string }) => s.id)
    if (shedIds.length === 0) return 0

    const { data: batchesData } = await supabase
      .from('batches')
      .select('id, shed_id, starting_bird_count')
      .in('shed_id', shedIds)
      .eq('status', 'active')
    const activeBatches = batchesData ?? []
    const activeBatchIds = activeBatches.map((b: { id: string }) => b.id)
    if (activeBatchIds.length === 0) return 0

    const today = new Date().toISOString().split('T')[0]
    const threeDaysAgo = (() => {
      const d = new Date(); d.setDate(d.getDate() - 3); return d.toISOString().split('T')[0]
    })()

    const [recentLogsRes, allLogsRes, todayLogsRes] = await Promise.all([
      supabase.from('daily_logs')
        .select('batch_id, log_date, mortality_count, feed_given_kg, feed_stock_remaining_kg')
        .in('batch_id', activeBatchIds)
        .gte('log_date', threeDaysAgo)
        .order('log_date', { ascending: false }),
      supabase.from('daily_logs')
        .select('batch_id, mortality_count')
        .in('batch_id', activeBatchIds),
      supabase.from('daily_logs')
        .select('batch_id, feed_stock_remaining_kg')
        .in('batch_id', activeBatchIds)
        .eq('log_date', today),
    ])

    const recentLogs = recentLogsRes.data ?? []
    const allLogs = allLogsRes.data ?? []
    const todayLogs = todayLogsRes.data ?? []
    const todayLoggedIds = new Set(todayLogs.map((l: { batch_id: string }) => l.batch_id))

    let count = 0

    for (const batch of activeBatches as Array<{ id: string; shed_id: string; starting_bird_count: number }>) {
      const batchLogs = recentLogs.filter((l: { batch_id: string }) => l.batch_id === batch.id)
      const allBatchLogs = allLogs.filter((l: { batch_id: string }) => l.batch_id === batch.id)
      const todayLog = todayLogs.find((l: { batch_id: string }) => l.batch_id === batch.id)

      // Missing log
      if (!todayLoggedIds.has(batch.id)) count++

      // Mortality spike
      const todayEntry = batchLogs.find((l: { log_date: string }) => l.log_date === today)
      const prior = batchLogs.filter((l: { log_date: string }) => l.log_date !== today)
      if (todayEntry && prior.length >= 1) {
        const avg = prior.reduce((s: number, l: { mortality_count: number }) => s + Number(l.mortality_count), 0) / prior.length
        if (avg > 0 && Number(todayEntry.mortality_count) > avg * 2) count++
      }

      // Cumulative mortality >= 5%
      const totalMort = allBatchLogs.reduce((s: number, l: { mortality_count: number }) => s + Number(l.mortality_count), 0)
      if ((totalMort / batch.starting_bird_count) * 100 >= 5) count++

      // Low feed stock
      if (todayLog && (todayLog as { feed_stock_remaining_kg: number | null }).feed_stock_remaining_kg !== null) {
        const stockKg = Number((todayLog as { feed_stock_remaining_kg: number }).feed_stock_remaining_kg)
        const last3 = batchLogs.filter((l: { log_date: string }) => l.log_date !== today).slice(0, 3)
        if (last3.length > 0) {
          const avgFeed = last3.reduce((s: number, l: { feed_given_kg: number }) => s + Number(l.feed_given_kg), 0) / last3.length
          if (avgFeed > 0 && stockKg / avgFeed <= 2) count++
        }
      }
    }

    return count
  } catch {
    return 0
  }
}
