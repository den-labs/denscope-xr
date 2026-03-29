import { collectMetrics } from '../src/lib/metrics/collect'

function fmt(n: number): string {
  return n.toLocaleString('en-US').padStart(10)
}

function pct(n: number): string {
  return `${(n * 100).toFixed(1)}%`.padStart(10)
}

async function main() {
  const metrics = await collectMetrics()

  const line = '─'.repeat(44)

  console.log(`DenScope Metrics — ${metrics.collectedAt}`)
  console.log(line)
  console.log()
  console.log('Adoption')
  console.log(`  Owner Profiles          ${fmt(metrics.adoption.ownerProfiles)}`)
  console.log(`  API Keys                ${fmt(metrics.adoption.apiKeysTotal)}`)
  console.log(`  API Keys (Last 7d)      ${fmt(metrics.adoption.apiKeysLast7d)}`)
  console.log(`  API Keys with Usage     ${fmt(metrics.adoption.apiKeysWithUsage)}`)
  console.log(`  Key → First Call Conv.  ${pct(metrics.adoption.conversionRate)}`)
  console.log()
  console.log('Usage')
  console.log(`  API Calls (Last 7d)     ${fmt(metrics.usage.apiCallsLast7d)}`)
  console.log(`  x402 Payments           ${fmt(metrics.usage.x402PaymentsTotal)}`)
  console.log()
  console.log('Trust Surface')
  console.log(`  Agents                  ${fmt(metrics.trustSurface.agentsTotal)}`)
  console.log(`  Events                  ${fmt(metrics.trustSurface.eventsTotal)}`)
  console.log(`  Events (Last 7d)        ${fmt(metrics.trustSurface.eventsLast7d)}`)
  console.log(`  Active Agents (Last 7d) ${fmt(metrics.trustSurface.activeAgentsLast7d)}`)
  console.log(`  Certificates            ${fmt(metrics.trustSurface.certificatesTotal)}`)
  console.log(`  Certificates (Last 7d)  ${fmt(metrics.trustSurface.certificatesLast7d)}`)
}

main().catch((err) => {
  console.error('Error collecting metrics:', err.message ?? err)
  process.exit(1)
})
