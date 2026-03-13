import { describe, it, expect, vi, beforeEach } from 'vitest'
import { uploadAgentMetadata } from '../upload'

describe('uploadAgentMetadata', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('returns uri on success', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ uri: 'ipfs://Qm123' }),
    })

    const uri = await uploadAgentMetadata({
      name: 'Agent', description: 'Test agent', chainId: 42220,
    })

    expect(uri).toBe('ipfs://Qm123')
    expect(fetch).toHaveBeenCalledWith('/api/ipfs/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Agent', description: 'Test agent', chainId: 42220 }),
    })
  })

  it('throws error message from response body on failure', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ error: 'Pinata quota exceeded' }),
    })

    await expect(
      uploadAgentMetadata({ name: 'A', description: 'B', chainId: 42220 })
    ).rejects.toThrow('Pinata quota exceeded')
  })

  it('throws fallback message when response body parsing fails', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: () => Promise.reject(new Error('invalid json')),
    })

    await expect(
      uploadAgentMetadata({ name: 'A', description: 'B', chainId: 42220 })
    ).rejects.toThrow('Upload failed')
  })
})
