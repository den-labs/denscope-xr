import { NextRequest, NextResponse } from 'next/server'
import { getChain } from '@/config/chains'
import { requireSession } from '@/lib/auth/session'

export async function POST(req: NextRequest) {
  const session = await requireSession()
  if (!session.ok) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  try {
    const jwt = process.env.PINATA_JWT
    if (!jwt) {
      return NextResponse.json(
        { error: 'IPFS upload not configured' },
        { status: 503 }
      )
    }

    const { name, description, image, chainId } = await req.json()

    if (!name || !description || !chainId) {
      return NextResponse.json(
        { error: 'Missing required fields: name, description, chainId' },
        { status: 400 }
      )
    }

    const chain = getChain(chainId)
    if (!chain) {
      return NextResponse.json(
        { error: 'Unsupported chain' },
        { status: 400 }
      )
    }

    const metadata = {
      type: 'https://eips.ethereum.org/EIPS/eip-8004#registration-v1',
      name,
      description,
      ...(image ? { image } : {}),
      services: [],
      x402Support: false,
      active: true,
      registrations: [
        {
          agentId: 0,
          agentRegistry: `eip155:${chain.id}:${chain.contracts.identity}`,
        },
      ],
      supportedTrust: ['reputation'],
    }

    const blob = new Blob([JSON.stringify(metadata)], {
      type: 'application/json',
    })
    const file = new File([blob], `erc8004-agent-${name}.json`, {
      type: 'application/json',
    })

    const formData = new FormData()
    formData.append('file', file)
    formData.append('network', 'public')

    const pinataRes = await fetch(
      'https://uploads.pinata.cloud/v3/files',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${jwt}`,
        },
        body: formData,
      }
    )

    if (!pinataRes.ok) {
      const err = await pinataRes.text()
      console.error('Pinata error:', err)
      return NextResponse.json(
        { error: 'IPFS upload failed' },
        { status: 502 }
      )
    }

    const { data } = await pinataRes.json()

    return NextResponse.json({ uri: `ipfs://${data.cid}` })
  } catch (err) {
    console.error('IPFS upload error:', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
