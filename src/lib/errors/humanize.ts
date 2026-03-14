/**
 * Convert raw wallet/viem/RPC errors into user-friendly messages.
 * Keeps technical details out of the UI while preserving known API errors.
 */
export function humanizeError(error: unknown): string {
  const msg = error instanceof Error ? error.message : String(error)
  const lower = msg.toLowerCase()

  // User-initiated cancellation
  if (lower.includes('user rejected') || lower.includes('user denied') || lower.includes('action_rejected')) {
    return 'Transaction cancelled.'
  }

  // Wallet not connected or locked
  if (lower.includes('no provider') || lower.includes('wallet not connected') || lower.includes('disconnected')) {
    return 'Wallet not connected. Please connect your wallet and try again.'
  }

  // Insufficient funds
  if (lower.includes('insufficient funds') || lower.includes('exceeds balance')) {
    return 'Insufficient funds for gas. Please add funds and try again.'
  }

  // Chain mismatch
  if (lower.includes('chain mismatch') || lower.includes('wrong network') || lower.includes('switch chain')) {
    return 'Wrong network. Please switch to the correct chain.'
  }

  // Nonce / transaction conflicts
  if (lower.includes('nonce too low') || lower.includes('replacement underpriced') || lower.includes('already known')) {
    return 'Transaction conflict. Please wait a moment and try again.'
  }

  // Transaction reverted on-chain
  if (lower.includes('execution reverted') || lower.includes('revert')) {
    return 'Transaction failed on-chain. The contract rejected the operation.'
  }

  // Timeout
  if (lower.includes('timeout') || lower.includes('timed out')) {
    return 'Request timed out. Please try again.'
  }

  // Network errors
  if (lower.includes('network') || lower.includes('fetch failed') || lower.includes('failed to fetch')) {
    return 'Network error. Please check your connection and try again.'
  }

  // Known API errors (pass through — these are already human-readable)
  if (msg.startsWith('Agent not found') || msg.startsWith('Claim failed') ||
      msg.startsWith('Upload failed') || msg.startsWith('Image upload failed') ||
      msg.startsWith('IPFS upload failed') || msg.startsWith('Missing') ||
      msg.startsWith('Invalid') || msg.startsWith('Authentication required')) {
    return msg
  }

  // Generic fallback — don't expose raw error
  return 'Something went wrong. Please try again.'
}
