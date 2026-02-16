import { ConsoleGuard } from '@/components/console/ConsoleGuard'
import { ClaimedAgentsList } from '@/components/console/ClaimedAgentsList'
import { IncidentTimeline } from '@/components/console/IncidentTimeline'
import { AlertsPanel } from '@/components/console/AlertsPanel'
import { ApiKeysPanel } from '@/components/console/ApiKeysPanel'

export const metadata = {
  title: 'Console — DenScope',
  description: 'Manage your claimed ERC-8004 agents',
}

export default function ConsolePage() {
  return (
    <div className="h-full overflow-y-auto">
      <div className="bg-grid mx-auto max-w-4xl px-6 py-10">
        <ConsoleGuard>
          <nav className="font-mono text-xs text-text-muted uppercase tracking-wider">
            System / DenScope / Console
          </nav>

          <h1 className="font-display text-3xl font-bold uppercase tracking-wider mt-4 text-text-primary">
            Owner Console
          </h1>
          <p className="mt-1 text-sm text-text-secondary">
            Your claimed agents and dashboard.
          </p>

          <div className="mt-8">
            <h2 className="text-xs text-text-muted uppercase tracking-wider font-mono mb-4">
              Claimed Agents
            </h2>
            <ClaimedAgentsList />
          </div>

          {/* Signals Timeline */}
          <div className="mt-10">
            <h2 className="text-xs text-text-muted uppercase tracking-wider font-mono mb-4">
              Signals
            </h2>
            <IncidentTimeline />
          </div>

          {/* Alerts Configuration */}
          <div className="mt-10">
            <AlertsPanel />
          </div>

          {/* API Keys */}
          <section>
            <h2 className="font-display text-xl font-bold uppercase tracking-wider text-text-primary mb-4">
              API ACCESS
            </h2>
            <ApiKeysPanel />
          </section>
        </ConsoleGuard>
      </div>
    </div>
  )
}
