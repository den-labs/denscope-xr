import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { EvidenceDrawer } from '../EvidenceDrawer'

describe('EvidenceDrawer', () => {
  it('lives under the #evidence anchor', () => {
    const { container } = render(
      <EvidenceDrawer>
        <p>raw evidence</p>
      </EvidenceDrawer>
    )
    expect(container.querySelector('#evidence')).not.toBeNull()
  })

  it('is collapsed by default and reveals children on toggle', () => {
    render(
      <EvidenceDrawer>
        <p>raw evidence</p>
      </EvidenceDrawer>
    )
    expect(screen.queryByText('raw evidence')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /evidence/i }))
    expect(screen.getByText('raw evidence')).toBeInTheDocument()
  })
})
