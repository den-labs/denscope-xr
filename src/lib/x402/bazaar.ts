import { declareDiscoveryExtension } from '@x402/extensions/bazaar'

/**
 * Bazaar discovery metadata for the paid trust-evaluation resource.
 *
 * WHY THIS EXISTS
 *
 * The hosted facilitator catalogues a resource only when a settled payment's
 * payload carries this extension. Its first gate, read from source
 * (`packages/catalog/src/catalog.ts`), is:
 *
 *     const raw = paymentPayload.extensions?.[BAZAAR.key];
 *     if (!raw || typeof raw !== "object")
 *       return { kind: "skipped", reason: "no-bazaar-extension" };
 *
 * DenScope's first Stellar settlement produced no catalog entry because its 402
 * declared no `extensions` at all, so a conforming buyer had nothing to carry.
 *
 * WHAT IT IS NOT
 *
 * Not a ranking device. Every field below describes what the route actually
 * accepts and returns — no capability is claimed that `route.ts` does not
 * implement, and no phrase is present whose only purpose is to be retrieved.
 * `context`, `objective` and `sensitivity` are declared as accepted, and the
 * response's own `limitations[]` states plainly that they do not affect the
 * result.
 *
 * Discovery metadata is also never economic authority. The facilitator derives
 * `payTo` / `network` / `scheme` / `asset` / `amount` from the payment
 * requirements it validated, never from anything here (its invariant I4).
 *
 * `method` is supplied explicitly. The official builder omits it because the
 * upstream resource-server extension fills it in at request time; DenScope
 * builds its 402 without that server (see `rails/stellar.ts`), so it is the
 * component that must say POST. The generated schema requires the field, so an
 * omission would fail validation rather than pass silently.
 */

/** Bound shared with the route. A hint longer than this is rejected there. */
const MAX_HINT_CHARS = 512

/** The presets `isValidPreset()` accepts. Kept in step with `PresetId`. */
const PRESET_IDS = ['default_safety', 'agent_to_agent', 'defi_counterparty'] as const

/**
 * A realistic, entirely static example response.
 *
 * Hand-written from the shipped response shape, never captured from a live
 * call: an example must not carry real agent data, and it must not go stale
 * because a score moved. Values are plausible and internally consistent.
 */
const OUTPUT_EXAMPLE = {
  evaluation: {
    recommended_action: 'review',
    trust_band: 'medium',
    status: 'active',
    risk_level: 'moderate',
    signal_strength: 'moderate',
    decision_confidence: 'medium',
    flags: ['incident_open_warning'],
    rationale:
      'Agent scores 58/100 with medium confidence (7 feedbacks, 71% positive). One open warning incident.',
    evidence: {
      score: 58,
      score_confidence: 'medium',
      feedbackCount: 7,
      positiveRatio: 0.71,
      openIncidents: 1,
      lastActivityDays: 12,
      ageDays: 140,
    },
    preset: 'defi_counterparty',
    evaluatedAt: '2026-08-20T20:27:53.000Z',
    chainId: 42220,
    agentId: 5,
    limitations: [
      'Signal detectors run only for agents whose ownership has been claimed on DenScope; the absence of signals is not evidence of the absence of risk.',
      'context, objective and sensitivity are accepted for forward compatibility and do NOT affect this result.',
    ],
    dataAsOf: '2026-08-20T20:27:12.000Z',
  },
} as const

/**
 * Build the Bazaar extension block for the 402.
 *
 * Returns the shape `PaymentRequired.extensions` expects — `{ bazaar: … }` —
 * produced by the official builder rather than hand-written JSON, so the
 * generated JSON Schema and the declared info stay consistent with each other.
 *
 * @returns The extensions map to attach to a Payment Required response.
 */
export function buildBazaarExtension(): Record<string, unknown> {
  return declareDiscoveryExtension({
    // Not in the public config type — upstream expects its server extension to
    // add it. DenScope has no such server, and the schema marks it required.
    method: 'POST',
    bodyType: 'json',
    input: {
      chainId: 42220,
      agentId: 5,
      preset: 'defi_counterparty',
    },
    inputSchema: {
      chainId: {
        type: 'integer',
        description: 'CAIP-2 numeric chain id of an ERC-8004 registry DenScope indexes.',
      },
      agentId: {
        type: 'integer',
        minimum: 0,
        description: 'ERC-8004 agent id on that chain.',
      },
      preset: {
        type: 'string',
        enum: [...PRESET_IDS],
        description: 'Decision profile applied to the evidence.',
      },
      context: {
        type: 'string',
        maxLength: MAX_HINT_CHARS,
        description: 'Accepted for forward compatibility; does not affect the result.',
      },
      objective: {
        type: 'string',
        maxLength: MAX_HINT_CHARS,
        description: 'Accepted for forward compatibility; does not affect the result.',
      },
      sensitivity: {
        type: 'string',
        enum: ['low', 'normal', 'high'],
        description: 'Accepted for forward compatibility; does not affect the result.',
      },
    },
    output: { example: OUTPUT_EXAMPLE },
  } as Parameters<typeof declareDiscoveryExtension>[0])
}
