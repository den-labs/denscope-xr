/**
 * One-shot setup for a DEDICATED Stellar TESTNET buyer, used only to prove the
 * DenScope seller pilot end to end.
 *
 *   pnpm stellar:buyer-setup
 *
 * Creates a fresh account, funds it from Friendbot, adds the USDC trustline, and
 * acquires a small amount of TESTNET USDC from the testnet DEX via a strict-receive
 * path payment. The secret goes to a gitignored 0600 file and is never printed.
 *
 * This account is independent of the seller on purpose: the thesis being tested is
 * that an INDEPENDENT buyer can pay DenScope. A buyer that shared the seller's key
 * would prove nothing.
 *
 * TESTNET ONLY. Friendbot does not exist on pubnet, and every asset here is
 * worthless by construction.
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

const EXPECTED_USDC_SAC = 'CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA'
const USDC_CODE = 'USDC'
const USDC_ISSUER = 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5'

/** Enough for the single 0.001 payment, with margin. Not a stockpile. */
const USDC_TO_ACQUIRE = '0.0100000'
/** Cap on XLM spent acquiring it. The observed DEX rate is ~0.56 XLM per USDC. */
const MAX_XLM_TO_SPEND = '1.0000000'

const SECRET_FILE = resolve(process.cwd(), '.stellar-buyer-secret')

function assertAssetMatchesAdvertisedContract(): Asset {
  const asset = new Asset(USDC_CODE, USDC_ISSUER)
  const derived = asset.contractId(Networks.TESTNET)
  if (derived !== EXPECTED_USDC_SAC) {
    throw new Error(
      `asset mismatch: derives SAC ${derived}, expected ${EXPECTED_USDC_SAC}`,
    )
  }
  return asset
}

async function main() {
  const asset = assertAssetMatchesAdvertisedContract()
  console.log(`asset verified: ${USDC_CODE} -> ${EXPECTED_USDC_SAC}`)

  if (existsSync(SECRET_FILE)) {
    throw new Error(`${SECRET_FILE} already exists. Refusing to overwrite.`)
  }

  const buyer = Keypair.random()
  const publicKey = buyer.publicKey()

  writeFileSync(SECRET_FILE, `${buyer.secret()}\n`, { mode: 0o600 })
  console.log(`secret written to ${SECRET_FILE} (mode 0600, never printed)`)

  console.log(`funding ${publicKey} from Friendbot…`)
  const funded = await fetch(`${FRIENDBOT_URL}?addr=${encodeURIComponent(publicKey)}`)
  if (!funded.ok) throw new Error(`friendbot refused: HTTP ${funded.status}`)

  const server = new Horizon.Server(HORIZON_URL)

  console.log(`adding ${USDC_CODE} trustline…`)
  const trustTx = new TransactionBuilder(await server.loadAccount(publicKey), {
    fee: BASE_FEE,
    networkPassphrase: Networks.TESTNET,
  })
    .addOperation(Operation.changeTrust({ asset }))
    .setTimeout(60)
    .build()
  trustTx.sign(buyer)
  await server.submitTransaction(trustTx)

  console.log(`acquiring ${USDC_TO_ACQUIRE} ${USDC_CODE} from the testnet DEX…`)
  const buyTx = new TransactionBuilder(await server.loadAccount(publicKey), {
    fee: BASE_FEE,
    networkPassphrase: Networks.TESTNET,
  })
    .addOperation(
      Operation.pathPaymentStrictReceive({
        sendAsset: Asset.native(),
        sendMax: MAX_XLM_TO_SPEND,
        destination: publicKey,
        destAsset: asset,
        destAmount: USDC_TO_ACQUIRE,
        path: [],
      }),
    )
    .setTimeout(60)
    .build()
  buyTx.sign(buyer)
  await server.submitTransaction(buyTx)

  const after = await server.loadAccount(publicKey)
  const usdc = after.balances.find(
    (b) => 'asset_code' in b && b.asset_code === USDC_CODE && b.asset_issuer === USDC_ISSUER,
  )
  const xlm = after.balances.find((b) => b.asset_type === 'native')

  console.log('')
  console.log('=== DenScope Stellar testnet BUYER ===')
  console.log(`public: ${publicKey}`)
  console.log(`${USDC_CODE}: ${usdc && 'balance' in usdc ? usdc.balance : 'MISSING'}`)
  console.log(`XLM:  ${xlm && 'balance' in xlm ? xlm.balance : 'unknown'}`)
}

main().catch((error) => {
  // Never let an SDK error object reach stdout: submission errors carry the
  // signed envelope, and an envelope carries signatures.
  console.error('stellar-buyer-setup failed:', error instanceof Error ? error.message : 'unknown')
  process.exit(1)
})
