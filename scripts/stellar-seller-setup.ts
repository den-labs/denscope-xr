/**
 * One-shot setup for the DenScope Stellar TESTNET seller identity.
 *
 *   pnpm stellar:seller-setup
 *
 * What it does:
 *   1. generates a classic Stellar keypair;
 *   2. writes the SECRET to a gitignored file, mode 0600, and NEVER prints it;
 *   3. funds the account from Friendbot (testnet only);
 *   4. adds the USDC trustline the account needs before it can be credited;
 *   5. prints the PUBLIC address and the trustline status, and nothing else.
 *
 * What it deliberately does NOT do: hand the secret to the application. A seller
 * receives; it never authorises and never submits. Vercel gets
 * `X402_STELLAR_PAY_TO=G…` and nothing more. After running this, move the secret
 * file into the DenLabs treasury password manager and delete it from disk — it
 * is needed only to sweep funds later.
 *
 * TESTNET ONLY. Friendbot does not exist on pubnet, and this script refuses to
 * run against any other network.
 */

import { writeFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  Keypair,
  Networks,
  Asset,
  Operation,
  TransactionBuilder,
  Horizon,
  BASE_FEE,
} from '@stellar/stellar-sdk'

const HORIZON_URL = 'https://horizon-testnet.stellar.org'
const FRIENDBOT_URL = 'https://friendbot.stellar.org'

/** The SAC address DenScope advertises in its payment requirements. */
const EXPECTED_USDC_SAC = 'CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA'
const USDC_CODE = 'USDC'
const USDC_ISSUER = 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5'

/** Secret lands here. Gitignored. Never logged. */
const SECRET_FILE = resolve(process.cwd(), '.stellar-seller-secret')

/**
 * Prove the classic asset we add a trustline to is the SAME asset the SAC in our
 * payment requirements wraps.
 *
 * Without this the script could add a trustline to a lookalike USDC and the
 * seller would advertise an asset it cannot receive. The check is deterministic
 * and offline: a Stellar Asset Contract id is derived from (code, issuer,
 * network passphrase).
 */
function assertAssetMatchesAdvertisedContract(): Asset {
  const asset = new Asset(USDC_CODE, USDC_ISSUER)
  const derived = asset.contractId(Networks.TESTNET)
  if (derived !== EXPECTED_USDC_SAC) {
    throw new Error(
      `asset mismatch: ${USDC_CODE}:${USDC_ISSUER} derives SAC ${derived}, ` +
        `but payment requirements advertise ${EXPECTED_USDC_SAC}`,
    )
  }
  return asset
}

async function main() {
  const asset = assertAssetMatchesAdvertisedContract()
  console.log(`asset verified: ${USDC_CODE} -> ${EXPECTED_USDC_SAC}`)

  if (existsSync(SECRET_FILE)) {
    throw new Error(
      `${SECRET_FILE} already exists. Refusing to overwrite an existing seller ` +
        `secret — move it to the treasury and delete it first.`,
    )
  }

  const seller = Keypair.random()
  const publicKey = seller.publicKey()

  // Secret to disk BEFORE any network call: an account funded with a key we
  // failed to persist is an account nobody can ever sweep.
  writeFileSync(SECRET_FILE, `${seller.secret()}\n`, { mode: 0o600 })
  console.log(`secret written to ${SECRET_FILE} (mode 0600, never printed)`)

  console.log(`funding ${publicKey} from Friendbot…`)
  const funded = await fetch(`${FRIENDBOT_URL}?addr=${encodeURIComponent(publicKey)}`)
  if (!funded.ok) {
    throw new Error(`friendbot refused: HTTP ${funded.status}`)
  }

  const server = new Horizon.Server(HORIZON_URL)
  const account = await server.loadAccount(publicKey)

  console.log(`adding ${USDC_CODE} trustline…`)
  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: Networks.TESTNET,
  })
    .addOperation(Operation.changeTrust({ asset }))
    .setTimeout(60)
    .build()
  tx.sign(seller)
  await server.submitTransaction(tx)

  const after = await server.loadAccount(publicKey)
  const usdc = after.balances.find(
    (b) => 'asset_code' in b && b.asset_code === USDC_CODE && b.asset_issuer === USDC_ISSUER,
  )
  const xlm = after.balances.find((b) => b.asset_type === 'native')

  console.log('')
  console.log('=== DenScope Stellar testnet seller ===')
  console.log(`X402_STELLAR_PAY_TO=${publicKey}`)
  console.log(`trustline(${USDC_CODE}): ${usdc ? 'PRESENT' : 'MISSING'}`)
  console.log(`XLM balance: ${xlm && 'balance' in xlm ? xlm.balance : 'unknown'}`)
  console.log('')
  console.log('Next: move the secret file to the treasury password manager, delete it,')
  console.log('then set X402_STELLAR_PAY_TO in Vercel. The app never needs the secret.')
}

main().catch((error) => {
  // Never let a Stellar SDK error object reach stdout: submission errors can
  // carry the signed envelope, and an envelope carries signatures.
  console.error('stellar-seller-setup failed:', error instanceof Error ? error.message : 'unknown')
  process.exit(1)
})
