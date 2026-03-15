import { supabaseAdmin } from './admin'
import type { CertificatePayload } from '@/lib/trust/certificate'

export type CertificateSnapshotRow = {
  id: string
  hash: string
  chain_id: number
  agent_id: number
  payload: CertificatePayload
  image_key: string | null
  issued_at: string
}

export async function findSnapshotByHash(
  hash: string,
): Promise<CertificateSnapshotRow | null> {
  const { data } = await supabaseAdmin
    .from('certificate_snapshots')
    .select('*')
    .eq('hash', hash)
    .maybeSingle()
  return data as CertificateSnapshotRow | null
}

/**
 * Insert snapshot with ON CONFLICT safety for concurrent requests.
 * If hash already exists, returns the existing row.
 */
export async function insertSnapshot(
  hash: string,
  chainId: number,
  agentId: number,
  payload: CertificatePayload,
): Promise<CertificateSnapshotRow> {
  // Attempt insert — ON CONFLICT handled by unique constraint
  const { error } = await supabaseAdmin
    .from('certificate_snapshots')
    .insert({
      hash,
      chain_id: chainId,
      agent_id: agentId,
      payload: payload as unknown as Record<string, unknown>,
    })

  // If unique violation, row already exists — fetch it
  if (error && error.code === '23505') {
    const existing = await findSnapshotByHash(hash)
    if (existing) return existing
  }

  if (error && error.code !== '23505') {
    throw new Error(`Failed to insert certificate snapshot: ${error.message}`)
  }

  // Fetch the row we just inserted
  const row = await findSnapshotByHash(hash)
  if (!row) throw new Error('Snapshot insert succeeded but row not found')
  return row
}

export async function updateImageKey(
  hash: string,
  imageKey: string,
): Promise<void> {
  await supabaseAdmin
    .from('certificate_snapshots')
    .update({ image_key: imageKey })
    .eq('hash', hash)
}

/**
 * Find the latest snapshot for an agent that has a stored image.
 * Used for agent detail page OG metadata.
 */
export async function findLatestSnapshot(
  chainId: number,
  agentId: number,
): Promise<CertificateSnapshotRow | null> {
  const { data } = await supabaseAdmin
    .from('certificate_snapshots')
    .select('*')
    .eq('chain_id', chainId)
    .eq('agent_id', agentId)
    .not('image_key', 'is', null)
    .order('issued_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  return data as CertificateSnapshotRow | null
}
