import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

type TrustScoreRow = {
  chain_id: number
  agent_id: number
  score: number
  feedback_count: number
  positive_count: number
  negative_count: number
  confidence: 'low' | 'medium' | 'high'
}

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing env var: ${name}`)
  }
  return value
}

function pickFirst(rows: TrustScoreRow[], label: string, pred: (row: TrustScoreRow) => boolean) {
  const row = rows.find(pred)
  return { label, row }
}

async function main() {
  const url = requireEnv('NEXT_PUBLIC_SUPABASE_URL')
  const serviceKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY')
  const supabase = createClient(url, serviceKey)

  const { data, error } = await supabase
    .from('trust_scores')
    .select('chain_id,agent_id,score,feedback_count,positive_count,negative_count,confidence')
    .order('feedback_count', { ascending: false })
    .limit(200)

  if (error) throw error

  const rows = (data ?? []) as TrustScoreRow[]
  if (rows.length === 0) {
    console.log('No trust_scores rows found.')
    return
  }

  const withPositivePct = rows.map((r) => ({
    ...r,
    positive_pct: r.feedback_count > 0 ? Math.round((r.positive_count / r.feedback_count) * 100) : 0,
  }))

  const candidates = [
    pickFirst(rows, 'insufficient_signal', (r) => r.feedback_count < 5),
    pickFirst(rows, 'trustworthy', (r) => r.feedback_count >= 15 && r.confidence !== 'low' && (r.positive_count / Math.max(r.feedback_count, 1)) >= 0.7),
    pickFirst(rows, 'high_risk_or_monitoring', (r) => r.feedback_count >= 5 && (
      (r.feedback_count >= 15 && r.confidence !== 'low' && (r.positive_count / Math.max(r.feedback_count, 1)) <= 0.35)
      || (r.feedback_count >= 5 && r.feedback_count < 15)
    )),
  ]

  console.log('Suggested OG review candidates:')
  for (const c of candidates) {
    if (!c.row) {
      console.log(`- ${c.label}: NOT FOUND`)
      continue
    }
    const pct = c.row.feedback_count > 0
      ? Math.round((c.row.positive_count / c.row.feedback_count) * 100)
      : 0
    console.log(`- ${c.label}: chain=${c.row.chain_id} agent=${c.row.agent_id} score=${Math.round(c.row.score)} feedback=${c.row.feedback_count} pos=${pct}% conf=${c.row.confidence}`)
  }

  console.log('\nTop rows snapshot (for manual selection if needed):')
  console.log(JSON.stringify(withPositivePct.slice(0, 20), null, 2))
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})

