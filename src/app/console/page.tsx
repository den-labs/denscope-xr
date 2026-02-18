import { ConsoleGuard } from '@/components/console/ConsoleGuard'
import { RegisterAgentPanel } from '@/components/console/RegisterAgentPanel'
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

          <h1 className="font-display text-2xl font-bold uppercase tracking-wider mt-4 text-text-primary">
            Owner Console
          </h1>
          <p className="mt-1 text-sm text-text-secondary">
            Your claimed agents and dashboard.
          </p>

          <div className="mt-8">
            <h2 className="text-xs text-text-muted uppercase tracking-wider font-mono mb-1">
              Register Agent
            </h2>
            <p className="text-xs text-text-muted mb-4">
              Deploy a new ERC-8004 agent on-chain with metadata stored on IPFS.
            </p>
            <RegisterAgentPanel />
          </div>

          <div className="mt-8">
            <h2 className="text-xs text-text-muted uppercase tracking-wider font-mono mb-1">
              Claimed Agents
            </h2>
            <p className="text-xs text-text-muted mb-4">
              Agents you own on-chain. Visit an agent page and click &quot;Claim&quot; to verify ownership.
            </p>
            <ClaimedAgentsList />
          </div>

          <div className="mt-10">
            <h2 className="text-xs text-text-muted uppercase tracking-wider font-mono mb-1">
              Signals
            </h2>
            <p className="text-xs text-text-muted mb-4">
              Automated detections on your claimed agents — reputation drops, sybil patterns, feedback spikes.
            </p>
            <IncidentTimeline />
          </div>

          <div className="mt-10">
            <h2 className="text-xs text-text-muted uppercase tracking-wider font-mono mb-1">
              Alert Rules
            </h2>
            <p className="text-xs text-text-muted mb-4">
              Get notified via webhook when something happens. Connect Slack, Discord, or Telegram.
            </p>
            <AlertsPanel />
          </div>

          <div className="mt-10">
            <h2 className="text-xs text-text-muted uppercase tracking-wider font-mono mb-1">
              API Access
            </h2>
            <p className="text-xs text-text-muted mb-4">
              Generate keys to query trust scores and signals programmatically. Free tier: 100 requests/day.
            </p>
            <ApiKeysPanel />
          </div>
        </ConsoleGuard>
      </div>
    </div>
  )
}
