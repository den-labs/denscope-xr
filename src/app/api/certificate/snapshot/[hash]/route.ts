import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { findSnapshotByHash } from '@/lib/supabase/certificate-snapshots'

type Props = { params: Promise<{ hash: string }> }

/**
 * GET /api/certificate/snapshot/[hash]
 * Serves the stored certificate PNG by hash.
 * Resolves exclusively from stored snapshot — never reads current trust state.
 */
export async function GET(_req: Request, { params }: Props) {
  const { hash } = await params

  // Validate hash format (64-char hex)
  if (!/^[0-9a-f]{64}$/.test(hash)) {
    return new Response(null, { status: 404 })
  }

  const snapshot = await findSnapshotByHash(hash)
  if (!snapshot) {
    return new Response(null, { status: 404 })
  }

  // If image_key exists, serve from Supabase Storage
  if (snapshot.image_key) {
    try {
      const { data } = supabaseAdmin.storage
        .from('certificates')
        .getPublicUrl(snapshot.image_key)

      if (data?.publicUrl) {
        const imgRes = await fetch(data.publicUrl)
        if (imgRes.ok) {
          const buffer = await imgRes.arrayBuffer()
          return new Response(buffer, {
            headers: {
              'Content-Type': 'image/png',
              'Cache-Control': 'public, max-age=86400',
            },
          })
        }
      }
    } catch { /* storage read failed, fall through */ }
  }

  // image_key is null or storage read failed — redirect to generation endpoint
  // This will regenerate from current state (visual-equivalent) and attempt to store
  const { chainId, agentId } = snapshot.payload as { chainId: number; agentId: number }
  const generateUrl = new URL(`/api/certificate/${chainId}/${agentId}`, _req.url)
  return NextResponse.redirect(generateUrl, 307)
}
