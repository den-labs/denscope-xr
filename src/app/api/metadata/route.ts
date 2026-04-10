import { NextRequest, NextResponse } from 'next/server'
import { IPFS_GATEWAYS, METADATA_FETCH_TIMEOUT_MS } from '@/config/constants'
import { validateWebhookUrl } from '@/lib/security/url-validator'

function resolveIPFS(uri: string): string {
  if (uri.startsWith('ipfs://')) return `${IPFS_GATEWAYS[0]}${uri.replace('ipfs://', '')}`
  return uri
}

export async function GET(req: NextRequest) {
  const uri = req.nextUrl.searchParams.get('uri')
  if (!uri) {
    return NextResponse.json({ error: 'Missing uri parameter' }, { status: 400 })
  }

  const url = resolveIPFS(uri)
  const check = validateWebhookUrl(url)
  if (!check.safe) {
    return NextResponse.json({ error: 'Invalid or private URI' }, { status: 400 })
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), METADATA_FETCH_TIMEOUT_MS)

  try {
    const res = await fetch(url, { signal: controller.signal })
    if (!res.ok) {
      return NextResponse.json({ error: 'Upstream fetch failed' }, { status: 502 })
    }
    const json = await res.json()
    return NextResponse.json(json, {
      headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' },
    })
  } catch {
    return NextResponse.json({ error: 'Fetch failed' }, { status: 502 })
  } finally {
    clearTimeout(timeout)
  }
}
