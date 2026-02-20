export type DenEventKind = 'feedback'

export type DenRiskTier = 'healthy' | 'warning' | 'critical'

export type DenEvent = {
  id: string
  ts: number
  chainId: number
  kind: DenEventKind
  sourceId: string
  targetId: string
  value: number
}
