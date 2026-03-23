// src/components/console/IncidentTimeline.tsx
'use client'

import { useEffect, useState } from 'react'
import { useAccount } from 'wagmi'
import { fetchIncidentsForOwner } from '@/lib/supabase/incidents'
import { useIncidentStore } from '@/stores/incidents'
import { supabase } from '@/lib/supabase/client'
import { toIncident } from '@/types/incidents'
import type { Incident } from '@/types/incidents'

const SEVERITY_STYLES: Record<string, string> = {
  info: 'status-pill-accent',
  warning: 'status-pill-warning',
  critical: 'status-pill-critical',
}

function IncidentCard({ incident, onResolve }: { incident: Incident; onResolve: (id: string) => void }) {
  const [resolving, setResolving] = useState(false)

  async function handleResolve() {
    setResolving(true)
    const res = await fetch('/api/incidents/resolve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ incidentId: incident.id }),
    })
    if (res.ok) {
      onResolve(incident.id)
    }
    setResolving(false)
  }

  return (
    <div className="bg-surface border border-border p-4 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={`status-pill ${SEVERITY_STYLES[incident.severity] ?? 'status-pill-neutral'}`}>
            {incident.severity.toUpperCase()}
          </span>
          <span className="text-xs text-foreground font-bold">
            {incident.title}
          </span>
        </div>
        <span className="text-[11px] text-foreground-muted font-mono">
          {new Date(incident.triggeredAt).toLocaleString()}
        </span>
      </div>
      <p className="text-xs text-foreground-secondary">
        {incident.description}
      </p>
      {incident.whyItMatters && (
        <p className="text-xs text-foreground-muted italic">
          {incident.whyItMatters}
        </p>
      )}
      <div className="flex items-center justify-between pt-1">
        <span className="text-[11px] text-foreground-muted">
          Agent #{incident.agentId} &middot; Chain {incident.chainId}
        </span>
        {!incident.resolvedAt ? (
          <button
            onClick={handleResolve}
            disabled={resolving}
            className="text-[11px] text-interactive hover:underline disabled:opacity-50"
          >
            {resolving ? 'Resolving...' : 'Mark Resolved'}
          </button>
        ) : (
          <span className="text-[11px] text-success">Resolved</span>
        )}
      </div>
    </div>
  )
}

export function IncidentTimeline() {
  const { address } = useAccount()
  const { incidents, setIncidents, push, resolve } = useIncidentStore()
  const [loading, setLoading] = useState(true)

  // Fetch incidents on mount
  useEffect(() => {
    if (!address) return
    fetchIncidentsForOwner(address).then((data) => {
      setIncidents(data)
      setLoading(false)
    })
  }, [address, setIncidents])

  // Subscribe to realtime inserts
  useEffect(() => {
    if (!supabase || !address) return
    const channel = supabase
      .channel('incidents-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'incidents' },
        (payload) => {
          push(toIncident(payload.new))
        }
      )
      .subscribe()
    return () => { supabase?.removeChannel(channel) }
  }, [address, push])

  if (loading) {
    return <p className="text-xs text-foreground-muted">Loading signals...</p>
  }

  if (incidents.length === 0) {
    return (
      <div className="bg-surface border border-border p-8 text-center">
        <p className="text-sm text-foreground-secondary">No signals detected yet.</p>
        <p className="mt-2 text-xs text-foreground-muted">
          Signals appear when your agents receive feedback, reputation changes, or validation events.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {incidents.map((incident) => (
        <IncidentCard
          key={incident.id}
          incident={incident}
          onResolve={resolve}
        />
      ))}
    </div>
  )
}
