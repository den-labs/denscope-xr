export function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n))
}

export function easeOutCubic(t: number): number {
  return 1 - (1 - t) ** 3
}
