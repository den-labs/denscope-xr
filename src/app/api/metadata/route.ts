import { NextRequest, NextResponse } from 'next/server'
import { IPFS_GATEWAYS, METADATA_FETCH_TIMEOUT_MS } from '@/config/constants'

function resolveIPFS(uri: string): string {
  if (uri.startsWith('ipfs://')) return `${IPFS_GATEWAYS[0]}${uri.replace('ipfs://', '')}`
  return uri
}

function isAllowedURL(url: string): boolean {
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'https:' || parsed.protocol === 'http:'
  } catch {
    return false
  }
}

export async function GET(req: NextRequest) {
  const uri = req.nextUrl.searchParams.get('uri')
  if (!uri) {
    return NextResponse.json({ error: 'Missing uri parameter' }, { status: 400 })
  }

  const url = resolveIPFS(uri)
  if (!isAllowedURL(url)) {
    return NextResponse.json({ error: 'Invalid URI' }, { status: 400 })
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
