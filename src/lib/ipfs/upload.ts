export async function uploadAgentMetadata(metadata: {
  name: string
  description: string
  image?: string
  chainId: number
}): Promise<string> {
  const res = await fetch('/api/ipfs/upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(metadata),
  })

  if (!res.ok) {
    const data = await res.json().catch(() => ({ error: 'Upload failed' }))
    throw new Error(data.error ?? 'IPFS upload failed')
  }

  const { uri } = await res.json()
  return uri
}
