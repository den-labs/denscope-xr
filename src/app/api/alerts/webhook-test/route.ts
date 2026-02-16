// src/app/api/alerts/webhook-test/route.ts
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const { webhookUrl } = await req.json()

    if (!webhookUrl) {
      return NextResponse.json(
        { error: 'Missing webhookUrl' },
        { status: 400 }
      )
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
      consoleUrl: 'https://denscope.vercel.app/console',
    }

    const res = await fetch(webhookUrl, {
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
