import { NextRequest, NextResponse } from 'next/server'
import { siteUrl } from '@/config/site'
import { requireSession } from '@/lib/auth/session'
import { validateWebhookUrl } from '@/lib/security/url-validator'

export async function POST(req: NextRequest) {
  const session = await requireSession()
  if (!session.ok) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  try {
    const { webhookUrl } = await req.json()

    if (!webhookUrl) {
      return NextResponse.json({ error: 'Missing webhookUrl' }, { status: 400 })
    }

    const urlCheck = validateWebhookUrl(webhookUrl)
    if (!urlCheck.safe) {
      return NextResponse.json({ error: urlCheck.reason }, { status: 400 })
    }

    const testPayload = {
      incident: {
        id: 'test-00000000',
        signalKind: 'reputation_drop',
        severity: 'warning',
        title: 'Test Alert — DenScope',
        description: 'This is a test alert from DenScope.',
        whyItMatters: 'You configured webhook alerts for your agent.',
      },
      agent: { chainId: 42220, agentId: 0 },
      timestamp: new Date().toISOString(),
      consoleUrl: `${siteUrl()}/console`,
    }

    const res = await fetch(urlCheck.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testPayload),
    })

    return NextResponse.json({
      success: res.ok,
      status: res.status,
    })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Webhook send failed' },
      { status: 500 }
    )
  }
}
