import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import AppShell from '@/components/AppShell'
import { getAlertCount } from '@/lib/alertCount'

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Fetch alert count server-side — passed to AppShell for the nav badge
  const alertCount = await getAlertCount()

  return <AppShell alertCount={alertCount}>{children}</AppShell>
}
