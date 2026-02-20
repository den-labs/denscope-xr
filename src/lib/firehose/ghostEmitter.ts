const TWO_PI = Math.PI * 2
const BASE_RADIUS = 40
const RADIUS_SCALE = 25
const VALUE_CAP = 3

export function hashToUnit(seed: string): number {
  // FNV-1a 32-bit hash, stable across runtimes.
  let hash = 0x811c9dc5
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0) / 0x100000000
}

export function ghostPos(
  anchorX: number,
  anchorY: number,
  seed: string,
  valueAbs: number,
): { x: number; y: number } {
  const theta = hashToUnit(seed) * TWO_PI
  const radius = BASE_RADIUS + RADIUS_SCALE * Math.min(Math.abs(valueAbs), VALUE_CAP)
  return {
    x: anchorX + Math.cos(theta) * radius,
    y: anchorY + Math.sin(theta) * radius,
  }
}
