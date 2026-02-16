import { ConsoleGuard } from '@/components/console/ConsoleGuard'
import { ClaimedAgentsList } from '@/components/console/ClaimedAgentsList'

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

          {/* Placeholder sections for M5 */}
          <div className="mt-10 grid grid-cols-2 gap-4">
            <div className="bg-surface border border-border p-5">
              <h2 className="text-xs text-text-muted uppercase tracking-wider font-mono mb-2">
                Signals
              </h2>
              <p className="text-xs text-text-muted font-mono">Coming in M5</p>
            </div>
            <div className="bg-surface border border-border p-5">
              <h2 className="text-xs text-text-muted uppercase tracking-wider font-mono mb-2">
                Alerts
              </h2>
              <p className="text-xs text-text-muted font-mono">Coming in M5</p>
            </div>
          </div>
        </ConsoleGuard>
      </div>
    </div>
  )
}
