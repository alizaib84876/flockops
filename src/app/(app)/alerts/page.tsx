export const metadata = { title: 'Alerts — FlockOps' }

export default function AlertsPage() {
  return (
    <div className="container" style={{ paddingTop: '16px' }}>
      <h1 style={{ marginBottom: '24px' }}>Alerts</h1>
      <div className="empty-state">
        <div className="empty-state__icon">🔔</div>
        <div className="empty-state__title">No alerts</div>
        <div className="empty-state__desc">Alerts for mortality spikes, vaccination reminders, and low feed stock will appear here.</div>
      </div>
    </div>
  )
}
