import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { redirect } from 'next/navigation'

export const metadata = { title: 'Sheds — FlockOps' }

export default async function ShedsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: userRow } = await supabase
    .from('users')
    .select('farm_id')
    .eq('id', user.id)
    .single()

  const farmId = userRow?.farm_id

  let sheds: Array<{
    id: string
    name: string
    capacity: number
    location: string | null
    created_at: string
  }> = []

  if (farmId) {
    const { data } = await supabase
      .from('sheds')
      .select('id, name, capacity, location, created_at')
      .eq('farm_id', farmId)
      .order('name')
    sheds = data ?? []
  }

  return (
    <div className="container" style={{ paddingTop: '16px' }}>
      <div className="page-header" style={{ padding: '0 0 16px 0' }}>
        <div className="page-header__info">
          <h1 className="page-header__title">Sheds</h1>
          <p className="page-header__subtitle">{sheds.length} shed{sheds.length !== 1 ? 's' : ''} registered</p>
        </div>
        <Link href="/sheds/new" className="btn btn--primary btn--sm" id="btn-new-shed" style={{ width: 'auto' }}>
          + New Shed
        </Link>
      </div>

      {sheds.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state__icon">🏚️</div>
          <div className="empty-state__title">No sheds yet</div>
          <div className="empty-state__desc">Add your first broiler shed to begin tracking batches and daily logs.</div>
          <Link href="/sheds/new" className="btn btn--primary" style={{ marginTop: '8px' }} id="btn-add-first-shed-sheds">
            Add First Shed
          </Link>
        </div>
      ) : (
        <div className="stack stack--sm">
          {sheds.map(shed => (
            <Link
              key={shed.id}
              href={`/sheds/${shed.id}`}
              className="list-item"
              id={`shed-item-${shed.id}`}
            >
              <div className="list-item__icon">🏠</div>
              <div className="list-item__body">
                <div className="list-item__title">{shed.name}</div>
                <div className="list-item__subtitle">
                  {shed.capacity.toLocaleString()} birds capacity
                  {shed.location ? ` · ${shed.location}` : ''}
                </div>
              </div>
              <div className="list-item__right">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 18l6-6-6-6" />
                </svg>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
