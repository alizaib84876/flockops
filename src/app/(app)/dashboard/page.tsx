import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { redirect } from 'next/navigation'

export const metadata = {
  title: 'Dashboard — FlockOps',
}

export default async function DashboardPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Fetch the user's farm_id (single farm for Phase A)
  const userResult = await supabase
    .from('users')
    .select('farm_id')
    .eq('id', user.id)
    .single()

  // Fetch all sheds with their active batch info
  const farmId = (userResult.data as { farm_id: string | null } | null)?.farm_id
  let sheds: Array<{
    id: string
    name: string
    capacity: number
    location: string | null
    batches: Array<{
      id: string
      breed: string
      placement_date: string
      starting_bird_count: number
      status: string
    }>
  }> = []

  if (farmId) {
    const { data } = await supabase
      .from('sheds')
      .select(`
        id, name, capacity, location,
        batches!inner(id, breed, placement_date, starting_bird_count, status)
      `)
      .eq('farm_id', farmId)
      .eq('batches.status', 'active')
      .order('name')

    // Also get sheds without active batches
    const { data: allSheds } = await supabase
      .from('sheds')
      .select('id, name, capacity, location')
      .eq('farm_id', farmId)
      .order('name')

    const activeShedIds = new Set((data ?? []).map((s: { id: string }) => s.id))
    const inactiveSheds = (allSheds ?? [])
      .filter((s: { id: string }) => !activeShedIds.has(s.id))
      .map((s: { id: string; name: string; capacity: number; location: string | null }) => ({ ...s, batches: [] }))

    sheds = [...(data ?? []), ...inactiveSheds].sort((a, b) => a.name.localeCompare(b.name))
  }

  const hasFarm = !!farmId
  const hasSheds = sheds.length > 0

  function getDayOfCycle(placementDate: string): number {
    const placed = new Date(placementDate)
    const today = new Date()
    const diff = Math.floor((today.getTime() - placed.getTime()) / (1000 * 60 * 60 * 24))
    return Math.max(0, diff) + 1
  }

  return (
    <div className="container" style={{ paddingTop: '16px', paddingBottom: '24px' }}>
      {/* Greeting */}
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '1.5rem', marginBottom: '4px' }}>
          Good {getGreeting()} 👋
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9375rem' }}>
          {hasFarm
            ? hasSheds
              ? `${sheds.filter(s => s.batches.length > 0).length} active batch${sheds.filter(s => s.batches.length > 0).length !== 1 ? 'es' : ''} running`
              : 'No sheds yet — add your first shed below'
            : 'Set up your farm to get started'}
        </p>
      </div>

      {/* No farm yet — onboarding CTA */}
      {!hasFarm && (
        <div className="card" style={{ textAlign: 'center', padding: '32px 24px' }}>
          <div style={{ fontSize: '3rem', marginBottom: '16px' }}>🏡</div>
          <h2 style={{ marginBottom: '8px' }}>Set Up Your Farm</h2>
          <p style={{ marginBottom: '24px', color: 'var(--text-muted)' }}>
            Create your farm profile to start managing sheds and batches.
          </p>
          <Link href="/settings/farm/new" className="btn btn--primary" id="btn-create-farm">
            Create Farm
          </Link>
        </div>
      )}

      {/* Sheds overview */}
      {hasFarm && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <p className="section-title">Your Sheds</p>
            <Link href="/sheds/new" className="btn btn--ghost btn--sm" id="btn-add-shed-dashboard">
              + Add Shed
            </Link>
          </div>

          {!hasSheds ? (
            <div className="empty-state">
              <div className="empty-state__icon">🏚️</div>
              <div className="empty-state__title">No sheds yet</div>
              <div className="empty-state__desc">Add your broiler sheds to start tracking batches.</div>
              <Link href="/sheds/new" className="btn btn--primary" style={{ marginTop: '8px' }} id="btn-add-first-shed">
                Add First Shed
              </Link>
            </div>
          ) : (
            <div className="stack stack--sm">
              {sheds.map(shed => {
                const activeBatch = shed.batches[0]
                const dayOfCycle = activeBatch ? getDayOfCycle(activeBatch.placement_date) : null

                return (
                  <Link
                    key={shed.id}
                    href={`/sheds/${shed.id}`}
                    className="list-item"
                    id={`shed-card-${shed.id}`}
                  >
                    <div className="list-item__icon">🏠</div>
                    <div className="list-item__body">
                      <div className="list-item__title">{shed.name}</div>
                      <div className="list-item__subtitle">
                        {activeBatch
                          ? `Day ${dayOfCycle} · ${activeBatch.breed} · ${activeBatch.starting_bird_count.toLocaleString()} birds`
                          : `Capacity: ${shed.capacity.toLocaleString()} birds · No active batch`
                        }
                      </div>
                    </div>
                    <div className="list-item__right">
                      {activeBatch
                        ? <span className="badge badge--active">Active</span>
                        : <span className="badge badge--closed">Idle</span>
                      }
                      {dayOfCycle && (
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          Day {dayOfCycle}
                        </span>
                      )}
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </>
      )}
    </div>
  )
}

function getGreeting(): string {
  const h = new Date().getHours()
  if (h < 12) return 'morning'
  if (h < 17) return 'afternoon'
  return 'evening'
}
