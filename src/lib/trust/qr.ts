import qrcode from 'qrcode-generator'

export type QRRect = {
  x: number
  y: number
  w: number
  h: number
}

/**
 * Generate a QR code matrix for a URL.
 * Returns a 2D boolean array where true = dark module.
 */
export function generateQRMatrix(url: string): boolean[][] {
  const qr = qrcode(0, 'M')
  qr.addData(url)
  qr.make()

  const count = qr.getModuleCount()
  const matrix: boolean[][] = []
  for (let row = 0; row < count; row++) {
    const rowData: boolean[] = []
    for (let col = 0; col < count; col++) {
      rowData.push(qr.isDark(row, col))
    }
    matrix.push(rowData)
  }
  return matrix
}

/**
 * Convert QR matrix to rectangles for rendering in next/og ImageResponse.
 * @param matrix - 2D boolean array from generateQRMatrix
 * @param size - total pixel size of the QR code (width = height)
 * @param offsetX - x position offset
 * @param offsetY - y position offset
 */
export function qrMatrixToRects(
  matrix: boolean[][],
  size: number,
  offsetX: number,
  offsetY: number,
): QRRect[] {
  const count = matrix.length
  if (count === 0) return []

  const moduleSize = size / count
  const rects: QRRect[] = []

  for (let row = 0; row < count; row++) {
    for (let col = 0; col < count; col++) {
      if (matrix[row][col]) {
        rects.push({
          x: offsetX + col * moduleSize,
          y: offsetY + row * moduleSize,
          w: moduleSize,
          h: moduleSize,
        })
      }
    }
  }

  return rects
}
