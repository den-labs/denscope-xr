import { NextRequest, NextResponse } from 'next/server'

const MAX_SIZE = 5 * 1024 * 1024 // 5 MB
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/svg+xml']

export async function POST(req: NextRequest) {
  try {
    const jwt = process.env.PINATA_JWT
    if (!jwt) {
      return NextResponse.json(
        { error: 'IPFS upload not configured' },
        { status: 503 }
      )
    }

    const formData = await req.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      )
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: 'File must be an image (PNG, JPG, WebP, GIF, SVG)' },
        { status: 400 }
      )
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: 'Image must be under 5 MB' },
        { status: 400 }
      )
    }

    const pinataForm = new FormData()
    pinataForm.append('file', file)
    pinataForm.append('network', 'public')

    const pinataRes = await fetch('https://uploads.pinata.cloud/v3/files', {
      method: 'POST',
      headers: { Authorization: `Bearer ${jwt}` },
      body: pinataForm,
    })

    if (!pinataRes.ok) {
      const err = await pinataRes.text()
      console.error('Pinata error:', err)
      return NextResponse.json(
        { error: 'Image upload failed' },
        { status: 502 }
      )
    }

    const { data } = await pinataRes.json()

    return NextResponse.json({ uri: `ipfs://${data.cid}` })
  } catch (err) {
    console.error('Image upload error:', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
