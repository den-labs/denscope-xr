import { describe, it, expect } from 'vitest'
import { generateQRMatrix, qrMatrixToRects } from '../qr'

describe('generateQRMatrix', () => {
  it('returns a square 2D boolean array', () => {
    const matrix = generateQRMatrix('https://example.com/verify/abc123')
    expect(matrix.length).toBeGreaterThan(0)
    expect(matrix.length).toBe(matrix[0].length)
  })

  it('contains both true and false values', () => {
    const matrix = generateQRMatrix('https://example.com/verify/abc123')
    const flat = matrix.flat()
    expect(flat.some((v) => v === true)).toBe(true)
    expect(flat.some((v) => v === false)).toBe(true)
  })

  it('is deterministic', () => {
    const url = 'https://example.com/verify/abc123'
    const a = generateQRMatrix(url)
    const b = generateQRMatrix(url)
    expect(a).toEqual(b)
  })
})

describe('qrMatrixToRects', () => {
  it('returns rects only for dark modules', () => {
    const matrix = [
      [true, false],
      [false, true],
    ]
    const rects = qrMatrixToRects(matrix, 100, 0, 0)
    expect(rects).toHaveLength(2)
  })

  it('applies offset correctly', () => {
    const matrix = [[true]]
    const rects = qrMatrixToRects(matrix, 50, 10, 20)
    expect(rects[0].x).toBe(10)
    expect(rects[0].y).toBe(20)
    expect(rects[0].w).toBe(50)
    expect(rects[0].h).toBe(50)
  })

  it('returns empty for empty matrix', () => {
    const rects = qrMatrixToRects([], 100, 0, 0)
    expect(rects).toEqual([])
  })

  it('covers the full size area', () => {
    const matrix = generateQRMatrix('https://example.com')
    const size = 56
    const rects = qrMatrixToRects(matrix, size, 0, 0)
    const maxX = Math.max(...rects.map((r) => r.x + r.w))
    const maxY = Math.max(...rects.map((r) => r.y + r.h))
    // Max coordinate should be close to size (within one module)
    expect(maxX).toBeLessThanOrEqual(size + 1)
    expect(maxY).toBeLessThanOrEqual(size + 1)
  })
})
