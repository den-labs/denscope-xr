import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { TrustRadar } from '../TrustRadar'
import type { DimensionResult, TrustSnapshotData } from '@/lib/trust-snapshot/types'

const dim = (value: number, rule: string, evidence: string[]): DimensionResult => ({
  value,
  rule,
  evidence,
  status: 'derived',
})

const radar: TrustSnapshotData['radar'] = {
  identity: dim(92, 'Sum of weighted metadata-presence components', ['uri_present=true']),
  reliability: dim(84, 'Age + URI stability + recency + validations', ['age_days=142']),
  reputation: dim(89, 'Positive ratio + volume + confidence', ['positive_ratio=0.86']),
  coordination: dim(71, 'Weighted sum of 5 derivable badges', ['a2a=connected']),
  safety: dim(78, '100 minus incident/sybil penalties', ['open_critical=0']),
}

describe('TrustRadar', () => {
  it('renders an accessible SVG with role img and aria-label', () => {
    render(<TrustRadar radar={radar} />)
    const img = screen.getByRole('img')
    expect(img).toHaveAttribute('aria-label', expect.stringContaining('Identity'))
    expect(img.getAttribute('aria-label')).toContain('92')
  })

  it('renders all five dimension labels', () => {
    render(<TrustRadar radar={radar} />)
    for (const label of ['Identity', 'Service reliability', 'Reputation', 'Coordination', 'Safety']) {
      expect(screen.getByText(new RegExp(label, 'i'))).toBeInTheDocument()
    }
  })

  it('shows the score-canonicality copy', () => {
    render(<TrustRadar radar={radar} />)
    expect(
      screen.getByText(/Dimensions interpret the score above — they do not replace it\./)
    ).toBeInTheDocument()
  })

  it('expands a dimension to reveal its rule and evidence on click', () => {
    render(<TrustRadar radar={radar} />)
    expect(screen.queryByText(/Sum of weighted metadata-presence/)).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Identity/i }))
    expect(screen.getByText(/Sum of weighted metadata-presence/)).toBeInTheDocument()
    expect(screen.getByText(/uri_present=true/)).toBeInTheDocument()
  })
})
