import { describe, it, expect } from 'vitest'
import { parseAgentMetadata } from '../metadata'

describe('parseAgentMetadata', () => {
  it('parses a valid registration JSON', () => {
    const json = {
      name: 'TestBot',
      description: 'A test agent',
      image: 'https://example.com/img.png',
      services: [
        { type: 'a2a', url: 'https://agent.example.com' },
        { type: 'mcp', url: 'https://mcp.example.com', version: '1.2' },
      ],
      x402: true,
    }
    const result = parseAgentMetadata(json)
    expect(result.name).toBe('TestBot')
    expect(result.services).toHaveLength(2)
    expect(result.x402).toBe(true)
  })

  it('handles missing optional fields', () => {
    const result = parseAgentMetadata({ name: 'MinimalBot' })
    expect(result.name).toBe('MinimalBot')
    expect(result.services).toEqual([])
    expect(result.x402).toBe(false)
  })
})
