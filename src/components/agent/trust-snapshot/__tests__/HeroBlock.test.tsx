import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { HeroBlock } from '../HeroBlock'
import { VERDICT_DISPLAY } from '../display'
import type { TrustSnapshotData } from '@/lib/trust-snapshot/types'

function makeSnapshot(over: Partial<TrustSnapshotData> = {}): TrustSnapshotData {
  return {
    score: 87,
    verdict: 'ready',
    confidence: 'high',
    summary: 'Active for 142d with 18/21 positive feedback and 3 protocols connected.',
    recommendedAction: { label: 'Pair on coordinated task', intent: 'primary', href: '#coordination' },
    radar: {} as TrustSnapshotData['radar'],
    strengths: [],
    watchouts: [],
    coordination: {} as TrustSnapshotData['coordination'],
    improvements: [],
    openIncidents: [],
    ...over,
  }
}

describe('VERDICT_DISPLAY', () => {
  it('maps every verdict to a label', () => {
    expect(VERDICT_DISPLAY.ready.label).toBe('Ready to coordinate')
    expect(VERDICT_DISPLAY['warming-up'].label).toBe('Warming up')
    expect(VERDICT_DISPLAY.caution.label).toBe('Caution')
    expect(VERDICT_DISPLAY['insufficient-data'].label).toBe('Insufficient data')
  })
})

describe('HeroBlock', () => {
  const identity = { agentName: 'Toppa', chainLabel: 'Celo', agentId: 1870, claimed: true }

  it('renders identity, score, verdict and summary', () => {
    render(<HeroBlock snapshot={makeSnapshot()} {...identity} />)
    expect(screen.getByText('Toppa')).toBeInTheDocument()
    expect(screen.getByText('#1870')).toBeInTheDocument()
    expect(screen.getByText('87')).toBeInTheDocument()
    expect(screen.getByText('Ready to coordinate')).toBeInTheDocument()
    expect(screen.getByText(/positive feedback/)).toBeInTheDocument()
  })

  it('renders the CTA as a link to its anchor href', () => {
    render(<HeroBlock snapshot={makeSnapshot()} {...identity} />)
    const cta = screen.getByRole('link', { name: /Pair on coordinated task/ })
    expect(cta).toHaveAttribute('href', '#coordination')
  })

  it('shows an em dash for a null score', () => {
    render(<HeroBlock snapshot={makeSnapshot({ score: null, verdict: 'insufficient-data' })} {...identity} />)
    expect(screen.getByText('—')).toBeInTheDocument()
  })

  it('renders a CLAIMED pill only when claimed', () => {
    const { rerender } = render(<HeroBlock snapshot={makeSnapshot()} {...identity} claimed />)
    expect(screen.getByText('CLAIMED')).toBeInTheDocument()
    rerender(<HeroBlock snapshot={makeSnapshot()} {...identity} claimed={false} />)
    expect(screen.queryByText('CLAIMED')).not.toBeInTheDocument()
  })
})
