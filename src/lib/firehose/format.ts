import type { DenEvent } from './types'

export function formatShortAddr(addr: string): string {
  if (addr.length <= 10) return addr
  return `${addr.slice(0, 5)}...${addr.slice(-3)}`
}

function parseSourceAddress(sourceId: string): string {
  const i = sourceId.indexOf(':')
  if (i === -1) return sourceId
  return sourceId.slice(i + 1)
}

function parseTargetLabel(targetId: string): string {
  const i = targetId.indexOf(':')
  const raw = i === -1 ? targetId : targetId.slice(i + 1)
  const agentId = Number(raw)
  return Number.isFinite(agentId) ? `#${agentId}` : targetId
}

function formatSignedValue(value: number): string {
  if (value > 0) return `+${value.toFixed(2)}`
  if (value < 0) return value.toFixed(2)
  return '0'
}

export function formatTapeRow(event: DenEvent): string {
  const prefix = event.value > 0 ? '+' : event.value < 0 ? '-' : ' '
  const addr = formatShortAddr(parseSourceAddress(event.sourceId))
  const target = parseTargetLabel(event.targetId)
  const value = formatSignedValue(event.value)
  return `${prefix} FEEDBACK ${addr} -> ${target} v=${value}`
}
