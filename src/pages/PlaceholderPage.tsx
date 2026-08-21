import { GlassPanel } from '../components/GlassPanel'

export function PlaceholderPage({
  title,
  description,
}: {
  title: string
  description: string
}) {
  return (
    <div className="page">
      <header className="page-header reveal-up">
        <h1>{title}</h1>
        <p>{description}</p>
      </header>
      <GlassPanel className="reveal-up delay-1">
        <p className="empty-note">此頁面即將推出。</p>
      </GlassPanel>
    </div>
  )
}
