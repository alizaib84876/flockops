import { redirect } from 'next/navigation'

// Root redirects to dashboard (which handles auth check itself)
export default function RootPage() {
  redirect('/dashboard')
}
