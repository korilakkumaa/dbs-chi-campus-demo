import { GlassPanel } from '../components/GlassPanel'
import { AsyncStatus } from '../components/AsyncStatus'

export function PlaceholderPage({
  title,
  description,
  upcoming = false,
}: {
  title: string
  description: string
  /** Mark unfinished destinations in primary IA */
  upcoming?: boolean
}) {
  return (
    <div className="page">
      <header className="page-header reveal-up">
        <h1>
          {title}
          {upcoming ? <span className="page-upcoming-badge">即將推出</span> : null}
        </h1>
        <p>{description}</p>
      </header>
      <GlassPanel className="reveal-up delay-1">
        <AsyncStatus
          variant="empty"
          panel={false}
          message="此頁面即將推出。"
        />
      </GlassPanel>
    </div>
  )
}
