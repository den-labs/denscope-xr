import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MobileStickyHeader } from '../MobileStickyHeader'
import type { TrustSnapshotData } from '@/lib/trust-snapshot/types'

function makeSnapshot(over: Partial<TrustSnapshotData> = {}): TrustSnapshotData {
  return {
    score: 87,
    verdict: 'ready',
    confidence: 'high',
    summary: 's',
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

describe('MobileStickyHeader', () => {
  it('shows agent name, score and verdict', () => {
    render(<MobileStickyHeader snapshot={makeSnapshot()} agentName="Toppa" agentId={1870} />)
    expect(screen.getByText('Toppa')).toBeInTheDocument()
    expect(screen.getByText('87')).toBeInTheDocument()
    expect(screen.getByText(/Ready to coordinate/i)).toBeInTheDocument()
  })

  it('renders the CTA link (never a Share action) (P1-6)', () => {
    render(<MobileStickyHeader snapshot={makeSnapshot()} agentName="Toppa" agentId={1870} />)
    expect(screen.getByRole('link', { name: /Pair on coordinated task/ })).toHaveAttribute('href', '#coordination')
    expect(screen.queryByText(/share/i)).not.toBeInTheDocument()
  })

  it('hides the CTA row for insufficient-data verdict (N8)', () => {
    render(
      <MobileStickyHeader
        snapshot={makeSnapshot({ score: null, verdict: 'insufficient-data' })}
        agentName="Toppa"
        agentId={1870}
      />
    )
    expect(screen.getByText(/Insufficient data/i)).toBeInTheDocument()
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })
})
