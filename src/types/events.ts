export type EventKind =
  | 'register'
  | 'uri_update'
  | 'metadata'
  | 'feedback'
  | 'feedback_revoked'
  | 'response'
  | 'validation_req'
  | 'validation_res'

export type RegisterData = { agentURI: string; owner: string }
export type URIUpdateData = { newURI: string; updatedBy: string }
export type MetadataData = { metadataKey: string; metadataValue: string }

export type FeedbackData = {
  clientAddress: string
  feedbackIndex: bigint
  value: bigint
  valueDecimals: number
  tag1: string
  tag2: string
  endpoint: string
  feedbackURI: string
  feedbackHash: string
}

export type FeedbackRevokedData = {
  clientAddress: string
  feedbackIndex: bigint
}

export type ResponseData = {
  clientAddress: string
  feedbackIndex: bigint
  responder: string
  responseURI: string
  responseHash: string
}

export type ScopeEventData =
  | RegisterData
  | URIUpdateData
  | MetadataData
  | FeedbackData
  | FeedbackRevokedData
  | ResponseData

export type ScopeEvent = {
  chainId: number
  block: number
  txHash: string
  logIndex: number
  timestamp?: number
  kind: EventKind
  agentId: number
  data: ScopeEventData
}
