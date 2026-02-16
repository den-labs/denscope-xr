# x402 Implementation Guide — From Zero to Payments

> Guide for implementar pagos por uso (pay-per-call) en cualquier API usando el protocolo x402 con el facilitador de UltravioletaDAO. Basado en la implementacion battle-tested (751+ tests, E2E verificado on-chain en Avalanche Fuji).

## Tabla de Contenidos

1. [Que es x402](#1-que-es-x402)
2. [Arquitectura y Flujo Completo](#2-arquitectura-y-flujo-completo)
3. [Pre-requisitos](#3-pre-requisitos)
4. [Paso 1: Tipos TypeScript](#4-paso-1-tipos-typescript)
5. [Paso 2: Configuracion del Servidor](#5-paso-2-configuracion-del-servidor)
6. [Paso 3: Generar Respuesta 402](#6-paso-3-generar-respuesta-402)
7. [Paso 4: Verificar y Liquidar Pagos](#7-paso-4-verificar-y-liquidar-pagos)
8. [Paso 5: Middleware de Autenticacion](#8-paso-5-middleware-de-autenticacion)
9. [Paso 6: Conectar a tu API](#9-paso-6-conectar-a-tu-api)
10. [Paso 7: Cliente — Llamar y Pagar](#10-paso-7-cliente--llamar-y-pagar)
11. [Paso 8: Script E2E de Prueba](#11-paso-8-script-e2e-de-prueba)
12. [Errores Comunes y Como Evitarlos](#12-errores-comunes-y-como-evitarlos)
13. [Referencia de Formatos JSON](#13-referencia-de-formatos-json)
14. [Variables de Entorno](#14-variables-de-entorno)
15. [Checklist de Implementacion](#15-checklist-de-implementacion)
16. [Redes Soportadas](#16-redes-soportadas)

---

## 1. Que es x402

**x402** implementa HTTP 402 (Payment Required) para cobrar por llamadas a una API usando USDC en blockchains EVM. El flujo es:

1. Cliente llama tu API sin autenticacion
2. Tu servidor responde HTTP 402 con instrucciones de pago (cuanto, a quien, en que red)
3. Cliente firma una autorizacion EIP-712 (sin gas, off-chain)
4. Cliente reintenta la llamada incluyendo la firma
5. Tu servidor envia la firma al **facilitador** de UltravioletaDAO
6. El facilitador verifica la firma y ejecuta la transferencia de USDC on-chain
7. Tu servidor da acceso al recurso

**Ventajas clave:**

- El cliente NO gasta gas (la firma es off-chain)
- El servidor NO necesita claves privadas
- El facilitador ejecuta `transferWithAuthorization` (EIP-3009) on-chain
- Compatible con cualquier EVM chain que tenga USDC con EIP-3009

**Facilitador:** `https://facilitator.ultravioletadao.xyz`

---

## 2. Arquitectura y Flujo Completo

```
Cliente (AI Agent / App)         Tu Servidor (API)              Facilitador UltravioletaDAO
        |                              |                                |
        |  POST /tu-endpoint           |                                |
        |  (sin auth)                  |                                |
        |-----------------------------→|                                |
        |                              |                                |
        |  ←--- HTTP 402              |                                |
        |  Header: PAYMENT-REQUIRED    |                                |
        |  (base64 JSON con precio,    |                                |
        |   wallet destino, red, asset)|                                |
        |                              |                                |
        |  Decodifica header           |                                |
        |  Firma EIP-712 (off-chain)   |                                |
        |  Construye X-PAYMENT header  |                                |
        |                              |                                |
        |  POST /tu-endpoint           |                                |
        |  Header: X-PAYMENT (base64)  |                                |
        |-----------------------------→|                                |
        |                              |  POST /verify                 |
        |                              |  {x402Version, paymentPayload,|
        |                              |   paymentRequirements}         |
        |                              |-------------------------------→|
        |                              |                                |
        |                              |  ←-- {isValid: true, payer}   |
        |                              |                                |
        |                              |  POST /settle                 |
        |                              |  (mismo body que /verify)     |
        |                              |-------------------------------→|
        |                              |                                |
        |                              |  ←-- {success: true,          |
        |                              |       transaction: "0x...",    |
        |                              |       payer: "0x..."}         |
        |                              |                                |
        |  ←--- HTTP 200              |                                |
        |  (respuesta normal)          |                                |
```

> **CRITICO:** El servidor DEBE llamar tanto `/verify` como `/settle`. Si solo llamas `/verify`, la firma se valida pero NUNCA se transfiere USDC. Estarias dando el servicio gratis.

---

## 3. Pre-requisitos

### Para tu servidor

```bash
# Crear proyecto
mkdir my-x402-api && cd my-x402-api
npm init -y

# Dependencias
npm install express typescript @types/express @types/node tsx
npx tsc --init
```

`tsconfig.json` minimo:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "dist",
    "strict": true,
    "esModuleInterop": true,
    "declaration": true
  },
  "include": ["src"]
}
```

`package.json`:

```json
{
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js"
  }
}
```

### Para tu cliente (testing)

```bash
npm install ethers dotenv
```

### Wallet de recepcion

Necesitas una wallet EVM para recibir pagos USDC. **No necesita tener fondos ni gas.**

```typescript
import { Wallet } from 'ethers'
const wallet = Wallet.createRandom()
console.log('Address:', wallet.address) // <- Esta es tu PAY_TO
console.log('Key:', wallet.privateKey) // <- Guardar en seguro
```

### Para testing en Fuji (testnet)

| Recurso      | URL                                          |
| ------------ | -------------------------------------------- |
| AVAX testnet | https://faucet.avax.network                  |
| USDC testnet | https://faucet.circle.com                    |
| Explorer     | https://testnet.snowtrace.io                 |
| RPC          | `https://api.avax-test.network/ext/bc/C/rpc` |

---

## 4. Paso 1: Tipos TypeScript

Crea `src/x402/types.ts`:

```typescript
// ─── Payment Requirement (lo que el servidor exige) ─────────────────

export interface PaymentRequirement {
  scheme: string // "exact" — pagar el monto exacto
  network: string // "eip155:43113" (formato CAIP-2)
  amount: string // micro-USDC como string ("1000" = $0.001)
  asset: string // Direccion del contrato USDC
  payTo: string // Wallet que recibe el pago
  maxTimeoutSeconds: number // Tiempo maximo para verificar (30)
  extra: Record<string, unknown> // Metadata EIP-3009
}

// ─── Respuesta 402 completa ─────────────────────────────────────────

export interface ResourceInfo {
  url: string // URL del recurso que se esta pagando
  description: string // Descripcion legible
  mimeType: string // "application/json"
}

export interface PaymentRequiredResponse {
  x402Version: number // Siempre 2
  accepts: PaymentRequirement[] // Opciones de pago (normalmente 1)
  resource: ResourceInfo // Recurso protegido
  error: string // "missing payment header"
}

// ─── Resultado de verificacion ──────────────────────────────────────

export interface X402VerifyResult {
  valid: boolean
  payer?: string // Wallet del pagador
  network?: string
  transaction?: string
  error?: string
}

// ─── Resultado de liquidacion ───────────────────────────────────────

export interface X402SettleResult {
  success: boolean
  transaction?: string // Hash de la tx on-chain
  network?: string
  payer?: string
  error?: string
}

// ─── Contexto adjunto al request despues de pago exitoso ────────────

export interface X402Context {
  payer: string // Wallet del pagador
  transaction?: string // Hash de la tx on-chain
  authMethod: 'x402' | 'api-key'
}
```

---

## 5. Paso 2: Configuracion del Servidor

Crea `src/x402/config.ts`:

```typescript
export const x402Config = {
  // Wallet que recibe los pagos USDC
  payTo: process.env.X402_PAY_TO || '',

  // Red blockchain (formato CAIP-2)
  // Fuji testnet: "eip155:43113"
  // Avalanche mainnet: "eip155:43114"
  network: process.env.X402_NETWORK || 'eip155:43113',

  // Contrato USDC en la red
  // Fuji: 0x5425890298aed601595a70AB815c96711a31Bc65
  // Avalanche mainnet: 0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E
  assetAddress:
    process.env.X402_ASSET_ADDRESS ||
    '0x5425890298aed601595a70AB815c96711a31Bc65',

  // Nombre del token (para el dominio EIP-712)
  assetName: process.env.X402_ASSET_NAME || 'USD Coin',

  // URL base publica de tu API (para el campo resource)
  baseUrl: process.env.X402_BASE_URL || 'http://localhost:3000',

  // URL del facilitador
  facilitatorUrl:
    process.env.X402_FACILITATOR_URL ||
    'https://facilitator.ultravioletadao.xyz',

  // Precios por endpoint (en USD)
  // $0.001 = 1000 micro-USDC
  pricing: {
    default: parseFloat(process.env.X402_PRICE_DEFAULT || '0.001'),
  } as Record<string, number>,
}
```

`.env`:

```bash
# x402 Configuration
X402_PAY_TO=0xTU_WALLET_AQUI
X402_NETWORK=eip155:43113
X402_ASSET_ADDRESS=0x5425890298aed601595a70AB815c96711a31Bc65
X402_ASSET_NAME=USD Coin
X402_BASE_URL=http://localhost:3000
X402_FACILITATOR_URL=https://facilitator.ultravioletadao.xyz
X402_PRICE_DEFAULT=0.001
```

---

## 6. Paso 3: Generar Respuesta 402

Crea `src/x402/payment-required.ts`:

```typescript
import type { PaymentRequiredResponse } from './types.js'

interface CreatePaymentRequiredOptions {
  payTo: string
  price: number // Precio en USD (0.001 = $0.001)
  network: string // "eip155:43113"
  assetAddress: string // Contrato USDC
  assetName: string // "USD Coin"
  resourceUrl: string // URL completa del endpoint
  description: string // Descripcion del servicio
}

export function createPaymentRequired(
  opts: CreatePaymentRequiredOptions,
): PaymentRequiredResponse {
  // Convertir USD a micro-USDC (USDC tiene 6 decimales)
  // $0.001 * 1,000,000 = 1000 micro-USDC
  const microUnits = Math.round(opts.price * 1_000_000)

  return {
    x402Version: 2,
    accepts: [
      {
        scheme: 'exact',
        network: opts.network,
        amount: String(microUnits), // SIEMPRE string en JSON
        asset: opts.assetAddress,
        payTo: opts.payTo,
        maxTimeoutSeconds: 30,
        extra: {
          // Indica que se usa EIP-3009 (TransferWithAuthorization)
          assetTransferMethod: 'eip3009',
          // Nombre y version del token para el dominio EIP-712
          // El cliente los usa para construir la firma
          name: opts.assetName,
          version: '2',
        },
      },
    ],
    resource: {
      url: opts.resourceUrl,
      description: opts.description,
      mimeType: 'application/json',
    },
    error: 'missing payment header',
  }
}
```

### Conversion de precios

| Precio USD | x 1,000,000 | micro-USDC | En JSON     |
| ---------- | ----------- | ---------- | ----------- |
| $0.001     | x 1,000,000 | 1,000      | `"1000"`    |
| $0.005     | x 1,000,000 | 5,000      | `"5000"`    |
| $0.01      | x 1,000,000 | 10,000     | `"10000"`   |
| $0.10      | x 1,000,000 | 100,000    | `"100000"`  |
| $1.00      | x 1,000,000 | 1,000,000  | `"1000000"` |

---

## 7. Paso 4: Verificar y Liquidar Pagos

Crea `src/x402/facilitator.ts`:

```typescript
import type {
  PaymentRequirement,
  X402VerifyResult,
  X402SettleResult,
} from './types.js'
import { x402Config } from './config.js'

/**
 * Verifica la firma EIP-712 con el facilitador (solo lectura, no mueve fondos).
 *
 * IMPORTANTE: Esto solo valida que la firma es correcta.
 * NO transfiere USDC. Debes llamar settleX402Payment() despues.
 */
export async function verifyX402Payment(
  paymentHeader: string,
  paymentRequirements: PaymentRequirement,
): Promise<X402VerifyResult> {
  try {
    // 1. Decodificar X-PAYMENT header (base64 -> JSON)
    const paymentPayload = JSON.parse(
      Buffer.from(paymentHeader, 'base64').toString('utf-8'),
    )

    // 2. Llamar al facilitador /verify
    const res = await fetch(`${x402Config.facilitatorUrl}/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        x402Version: 2,
        paymentPayload, // Lo que envio el cliente (decodificado)
        paymentRequirements, // Lo que tu servidor exige
      }),
      signal: AbortSignal.timeout(30_000),
    })

    if (!res.ok) {
      const text = await res.text().catch(() => '')
      return {
        valid: false,
        error: `Facilitator returned ${res.status}: ${text}`,
      }
    }

    const result = (await res.json()) as Record<string, unknown>

    // GOTCHA: El facilitador retorna "isValid" (NO "valid")
    //         y "invalidReason" (NO "error")
    if (result.isValid) {
      return {
        valid: true,
        payer: result.payer as string,
        network: result.network as string,
      }
    }

    return {
      valid: false,
      error: (result.invalidReason as string) || 'Payment verification failed',
    }
  } catch (error) {
    return { valid: false, error: `x402 verification error: ${error}` }
  }
}

/**
 * Liquida el pago on-chain via el facilitador.
 * Ejecuta transferWithAuthorization (EIP-3009) — mueve USDC de verdad.
 *
 * DEBE llamarse DESPUES de verifyX402Payment() exitoso.
 * Usa el MISMO body que /verify.
 */
export async function settleX402Payment(
  paymentHeader: string,
  paymentRequirements: PaymentRequirement,
): Promise<X402SettleResult> {
  try {
    // Decodificar X-PAYMENT header (igual que en verify)
    const paymentPayload = JSON.parse(
      Buffer.from(paymentHeader, 'base64').toString('utf-8'),
    )

    // Llamar al facilitador /settle (mismo formato que /verify)
    const res = await fetch(`${x402Config.facilitatorUrl}/settle`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        x402Version: 2,
        paymentPayload,
        paymentRequirements,
      }),
      signal: AbortSignal.timeout(30_000),
    })

    if (!res.ok) {
      const text = await res.text().catch(() => '')
      return {
        success: false,
        error: `Facilitator settle returned ${res.status}: ${text}`,
      }
    }

    const result = (await res.json()) as Record<string, unknown>

    // Respuesta exitosa: { success: true, transaction: "0x...", network, payer }
    // Respuesta fallida: { success: false, errorReason: "..." }
    if (result.success) {
      return {
        success: true,
        transaction: result.transaction as string, // Hash de la tx on-chain
        network: result.network as string,
        payer: result.payer as string,
      }
    }

    return {
      success: false,
      error: (result.errorReason as string) || 'Settlement failed',
    }
  } catch (error) {
    return { success: false, error: `x402 settlement error: ${error}` }
  }
}
```

---

## 8. Paso 5: Middleware de Autenticacion

Crea `src/x402/middleware.ts`:

```typescript
import type { Request, Response, NextFunction } from 'express'
import type { PaymentRequirement, X402Context } from './types.js'
import { verifyX402Payment, settleX402Payment } from './facilitator.js'
import { createPaymentRequired } from './payment-required.js'
import { x402Config } from './config.js'

// Extender Request de Express para incluir contexto x402
declare global {
  namespace Express {
    interface Request {
      x402?: X402Context
    }
  }
}

/**
 * Crea middleware x402 para un endpoint especifico.
 *
 * @param endpointPath - Path del endpoint (ej: "/api/analyze")
 * @param priceKey - Key en x402Config.pricing (ej: "default")
 * @param description - Descripcion del servicio
 */
export function createX402Middleware(
  endpointPath: string,
  priceKey: string = 'default',
  description: string = 'API endpoint',
) {
  return function x402Middleware(
    req: Request,
    res: Response,
    next: NextFunction,
  ): void {
    const paymentHeader = req.headers['x-payment'] as string | undefined

    // ─────────────────────────────────────────────────────────────────
    // CASO 1: Cliente envio X-PAYMENT header → verificar y liquidar
    // ─────────────────────────────────────────────────────────────────
    if (paymentHeader) {
      const price =
        x402Config.pricing[priceKey] ?? x402Config.pricing.default ?? 0.001
      const microUnits = Math.round(price * 1_000_000)

      // Reconstruir los requisitos de pago (deben coincidir con lo que se envio en el 402)
      const paymentRequirements: PaymentRequirement = {
        scheme: 'exact',
        network: x402Config.network,
        amount: String(microUnits),
        asset: x402Config.assetAddress,
        payTo: x402Config.payTo,
        maxTimeoutSeconds: 30,
        extra: {
          assetTransferMethod: 'eip3009',
          name: x402Config.assetName,
          version: '2',
        },
      }

      // Verificar + Liquidar
      verifyX402Payment(paymentHeader, paymentRequirements)
        .then(async (verifyResult) => {
          if (!verifyResult.valid) {
            res.status(402).json({
              error: 'payment_required',
              message: verifyResult.error || 'x402 payment verification failed',
            })
            return
          }

          // ⚠️ CRITICO: Llamar /settle DESPUES de /verify exitoso
          // Sin esto, validas la firma pero NUNCA cobras
          const settleResult = await settleX402Payment(
            paymentHeader,
            paymentRequirements,
          )

          if (!settleResult.success) {
            res.status(402).json({
              error: 'payment_required',
              message: settleResult.error || 'x402 payment settlement failed',
            })
            return
          }

          // Pago exitoso — adjuntar contexto al request
          req.x402 = {
            payer: settleResult.payer || verifyResult.payer || 'unknown',
            transaction: settleResult.transaction,
            authMethod: 'x402',
          }

          next() // Continuar al handler del endpoint
        })
        .catch(() => {
          res.status(402).json({
            error: 'payment_required',
            message: 'x402 payment verification error',
          })
        })
      return
    }

    // ─────────────────────────────────────────────────────────────────
    // CASO 2: Sin autenticacion → retornar 402 con instrucciones
    // ─────────────────────────────────────────────────────────────────
    if (!x402Config.payTo) {
      // x402 no configurado — retornar 401 normal
      res.status(401).json({
        error: 'unauthorized',
        message: 'Authentication required',
      })
      return
    }

    const price =
      x402Config.pricing[priceKey] ?? x402Config.pricing.default ?? 0.001
    const resourceUrl = `${x402Config.baseUrl}${endpointPath}`

    const paymentRequired = createPaymentRequired({
      payTo: x402Config.payTo,
      price,
      network: x402Config.network,
      assetAddress: x402Config.assetAddress,
      assetName: x402Config.assetName,
      resourceUrl,
      description,
    })

    // Codificar como base64 y enviar en header
    const header = Buffer.from(JSON.stringify(paymentRequired)).toString(
      'base64',
    )

    res.status(402)
    res.set('PAYMENT-REQUIRED', header)
    res.json({
      error: 'Payment Required',
      message:
        'This endpoint requires payment. See PAYMENT-REQUIRED header for instructions.',
    })
  }
}
```

---

## 9. Paso 6: Conectar a tu API

Crea `src/index.ts`:

```typescript
import express from 'express'
import { createX402Middleware } from './x402/middleware.js'

const app = express()
app.use(express.json())

// ─── Endpoint publico (sin pago) ────────────────────────────────────

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' })
})

// ─── Endpoint protegido con x402 ────────────────────────────────────

app.post(
  '/api/analyze',
  createX402Middleware('/api/analyze', 'default', 'AI Analysis Service'),
  (req, res) => {
    // Si llegas aqui, el pago fue verificado y liquidado on-chain
    const { payer, transaction } = req.x402!

    res.json({
      result: 'Your analysis result here',
      payment: {
        payer,
        transaction,
        explorer: `https://testnet.snowtrace.io/tx/${transaction}`,
      },
    })
  },
)

// ─── Multiples endpoints con diferentes precios ─────────────────────

// Agregar precios en config.ts:
// pricing: { default: 0.001, premium: 0.01, heavy: 0.05 }

app.post(
  '/api/premium',
  createX402Middleware('/api/premium', 'premium', 'Premium Service'),
  (req, res) => {
    res.json({ result: 'Premium result', payer: req.x402?.payer })
  },
)

// ─── Start ──────────────────────────────────────────────────────────

const PORT = parseInt(process.env.PORT || '3000', 10)
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`)
  console.log(`x402 payTo: ${process.env.X402_PAY_TO || '(not configured)'}`)
})
```

Estructura final del proyecto:

```
src/
├── index.ts              # Express app + rutas
└── x402/
    ├── types.ts          # Interfaces TypeScript
    ├── config.ts         # Variables de entorno
    ├── payment-required.ts  # Generar respuesta 402
    ├── facilitator.ts    # Llamadas a /verify y /settle
    └── middleware.ts      # Express middleware
```

---

## 10. Paso 7: Cliente — Llamar y Pagar

Este es el flujo completo desde el lado del cliente (AI agent, app, script):

```typescript
import { Wallet, JsonRpcProvider, Contract, randomBytes, hexlify } from 'ethers'

// ─── Configuracion ──────────────────────────────────────────────────

const API_URL = 'http://localhost:3000/api/analyze'
const RPC_URL = 'https://api.avax-test.network/ext/bc/C/rpc'
const USDC_ADDRESS = '0x5425890298aed601595a70AB815c96711a31Bc65'
const PRIVATE_KEY = process.env.WALLET_PRIVATE_KEY!

const provider = new JsonRpcProvider(RPC_URL, 43113)
const wallet = new Wallet(PRIVATE_KEY, provider)

// ─── PASO 1: Llamar sin auth → recibir 402 ─────────────────────────

const requestBody = JSON.stringify({ text: 'Analyze this for me' })

const res402 = await fetch(API_URL, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: requestBody,
})

if (res402.status !== 402) {
  throw new Error(`Expected 402, got ${res402.status}`)
}

// ─── PASO 2: Decodificar instrucciones de pago ─────────────────────

const paymentRequiredB64 = res402.headers.get('payment-required')
if (!paymentRequiredB64) throw new Error('No PAYMENT-REQUIRED header')

const payReq = JSON.parse(
  Buffer.from(paymentRequiredB64, 'base64').toString('utf-8'),
)
const accept = payReq.accepts[0]

console.log(`Price: ${Number(accept.amount) / 1e6} USDC`)
console.log(`PayTo: ${accept.payTo}`)

// ─── PASO 3: Firmar EIP-712 TransferWithAuthorization ───────────────

// El dominio EIP-712 se construye con datos del 402
const domain = {
  name: accept.extra.name, // "USD Coin"
  version: accept.extra.version, // "2"
  chainId: parseInt(accept.network.split(':')[1]), // 43113
  verifyingContract: accept.asset, // Contrato USDC
}

// Tipo para TransferWithAuthorization (EIP-3009)
const types = {
  TransferWithAuthorization: [
    { name: 'from', type: 'address' },
    { name: 'to', type: 'address' },
    { name: 'value', type: 'uint256' },
    { name: 'validAfter', type: 'uint256' },
    { name: 'validBefore', type: 'uint256' },
    { name: 'nonce', type: 'bytes32' },
  ],
}

// Nonce DEBE ser unico por cada llamada (32 bytes aleatorios)
const nonce = hexlify(randomBytes(32))

// validBefore: la firma expira en 1 hora
const validBefore = Math.floor(Date.now() / 1000) + 3600

const message = {
  from: wallet.address, // Tu wallet (el pagador)
  to: accept.payTo, // Wallet del servidor (receptor)
  value: accept.amount, // Micro-USDC como string
  validAfter: 0, // Valida inmediatamente
  validBefore, // Expira en 1 hora
  nonce, // Unico por llamada
}

const signature = await wallet.signTypedData(domain, types, message)

// ─── PASO 4: Construir X-PAYMENT header (V2) ───────────────────────
// ⚠️ CRITICO: V2 requiere devolver "resource" y "accepted" del 402

const xPaymentPayload = {
  x402Version: 2,
  resource: payReq.resource, // ← Devolver resource del 402
  accepted: accept, // ← Devolver accepts[0] del 402
  payload: {
    signature,
    authorization: {
      from: wallet.address,
      to: accept.payTo,
      value: accept.amount,
      validAfter: '0', // ← String, no numero
      validBefore: String(validBefore), // ← String, no numero
      nonce,
    },
  },
}

const xPaymentHeader = Buffer.from(JSON.stringify(xPaymentPayload)).toString(
  'base64',
)

// ─── PASO 5: Reintentar con pago → recibir 200 ─────────────────────

const res200 = await fetch(API_URL, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-PAYMENT': xPaymentHeader,
  },
  body: requestBody,
})

if (res200.status === 200) {
  const result = await res200.json()
  console.log('SUCCESS:', result)
} else {
  console.error(`FAILED: HTTP ${res200.status}`)
  console.error(await res200.json())
}
```

---

## 11. Paso 8: Script E2E de Prueba

Crea `scripts/test-x402.mjs` para verificar tu implementacion de punta a punta:

```javascript
#!/usr/bin/env node
/**
 * E2E Test: x402 Payment Flow
 *
 * Requiere:
 *   - Servidor corriendo (npm run dev)
 *   - WALLET_PRIVATE_KEY en .env (wallet con USDC en Fuji)
 *   - X402_PAY_TO configurado en el servidor
 *
 * Uso:
 *   node scripts/test-x402.mjs
 *   API_URL=https://tu-api.com/api/analyze node scripts/test-x402.mjs
 */

import { config } from 'dotenv'
import { Wallet, JsonRpcProvider, Contract, randomBytes, hexlify } from 'ethers'

config()

const PRIVATE_KEY = process.env.WALLET_PRIVATE_KEY
const API_URL = process.env.API_URL || 'http://localhost:3000/api/analyze'
const RPC_URL = 'https://api.avax-test.network/ext/bc/C/rpc'
const USDC_ADDRESS = '0x5425890298aed601595a70AB815c96711a31Bc65'
const CHAIN_ID = 43113

function log(step, msg, data) {
  const prefix = `[Step ${step}]`
  console.log(
    data
      ? `${prefix} ${msg} ${JSON.stringify(data, null, 2)}`
      : `${prefix} ${msg}`,
  )
}

async function main() {
  console.log('\n=== x402 E2E Test ===\n')

  if (!PRIVATE_KEY) {
    console.error('ERROR: Set WALLET_PRIVATE_KEY in .env')
    process.exit(1)
  }

  const provider = new JsonRpcProvider(RPC_URL, CHAIN_ID)
  const wallet = new Wallet(PRIVATE_KEY, provider)
  const address = await wallet.getAddress()

  log(0, `Wallet: ${address}`)
  log(0, `API: ${API_URL}`)

  // Check USDC balance
  const usdc = new Contract(
    USDC_ADDRESS,
    ['function balanceOf(address) view returns (uint256)'],
    provider,
  )
  const balance = Number(await usdc.balanceOf(address)) / 1e6
  log(0, `USDC balance: ${balance}`)

  if (balance < 0.001) {
    console.error(
      'ERROR: Need >= 0.001 USDC. Get testnet USDC at https://faucet.circle.com',
    )
    process.exit(1)
  }

  // Step 1: Call without auth → expect 402
  log(1, 'Calling API without auth...')
  const body = JSON.stringify({ text: 'test x402 payment' })

  const res402 = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  })

  log(1, `HTTP ${res402.status}`)

  if (res402.status !== 402) {
    console.error(`ERROR: Expected 402, got ${res402.status}`)
    console.error(await res402.text())
    process.exit(1)
  }

  // Step 2: Decode PAYMENT-REQUIRED
  log(2, 'Decoding PAYMENT-REQUIRED header...')
  const headerB64 = res402.headers.get('payment-required')
  if (!headerB64) {
    console.error('ERROR: No PAYMENT-REQUIRED header')
    process.exit(1)
  }

  const payReq = JSON.parse(Buffer.from(headerB64, 'base64').toString())
  const accept = payReq.accepts[0]

  log(
    2,
    `Amount: ${accept.amount} micro-USDC ($${Number(accept.amount) / 1e6})`,
  )
  log(2, `PayTo: ${accept.payTo}`)
  log(2, `Network: ${accept.network}`)

  // Step 3: Sign EIP-712
  log(3, 'Signing EIP-712 TransferWithAuthorization...')

  const domain = {
    name: accept.extra.name,
    version: accept.extra.version,
    chainId: parseInt(accept.network.split(':')[1]),
    verifyingContract: accept.asset,
  }

  const types = {
    TransferWithAuthorization: [
      { name: 'from', type: 'address' },
      { name: 'to', type: 'address' },
      { name: 'value', type: 'uint256' },
      { name: 'validAfter', type: 'uint256' },
      { name: 'validBefore', type: 'uint256' },
      { name: 'nonce', type: 'bytes32' },
    ],
  }

  const nonce = hexlify(randomBytes(32))
  const validBefore = Math.floor(Date.now() / 1000) + 3600

  const message = {
    from: address,
    to: accept.payTo,
    value: accept.amount,
    validAfter: 0,
    validBefore,
    nonce,
  }

  const signature = await wallet.signTypedData(domain, types, message)
  log(3, `Signature: ${signature.slice(0, 20)}...`)

  // Step 4: Build X-PAYMENT and retry
  log(4, 'Retrying with X-PAYMENT header...')

  const xPayment = Buffer.from(
    JSON.stringify({
      x402Version: 2,
      resource: payReq.resource,
      accepted: accept,
      payload: {
        signature,
        authorization: {
          from: address,
          to: accept.payTo,
          value: accept.amount,
          validAfter: '0',
          validBefore: String(validBefore),
          nonce,
        },
      },
    }),
  ).toString('base64')

  const res200 = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-PAYMENT': xPayment,
    },
    body,
  })

  log(4, `HTTP ${res200.status}`)
  const result = await res200.json()

  if (res200.status === 200) {
    console.log('\n=== SUCCESS ===')
    console.log(JSON.stringify(result, null, 2))
    if (result.payment?.transaction) {
      console.log(
        `\nVerify on-chain: https://testnet.snowtrace.io/tx/${result.payment.transaction}`,
      )
    }
  } else {
    console.error('\n=== FAILED ===')
    console.error(JSON.stringify(result, null, 2))
    process.exit(1)
  }
}

main().catch((err) => {
  console.error('FATAL:', err.message)
  process.exit(1)
})
```

---

## 12. Errores Comunes y Como Evitarlos

Estos son errores reales que encontramos durante la implementacion. Cada uno nos costo horas de debugging.

### Error 1: Solo llamar /verify sin /settle

```
PROBLEMA: La firma es valida, pero NUNCA se transfiere USDC.
          Estas dando tu servicio gratis.

SINTOMA:  /verify retorna { isValid: true } pero tu wallet
          nunca recibe USDC.

SOLUCION: SIEMPRE llamar /settle DESPUES de /verify exitoso.
          Ambos usan el mismo body.
```

### Error 2: Campos del facilitador mal nombrados

```
PROBLEMA: Tu codigo busca result.valid pero el facilitador
          retorna result.isValid.

CAMPOS CORRECTOS:
  /verify:  { isValid: boolean, invalidReason?: string, payer?: string }
  /settle:  { success: boolean, errorReason?: string, transaction?: string }

NO:
  /verify:  { valid, error }      ← INCORRECTO
  /settle:  { ok, reason }        ← INCORRECTO
```

### Error 3: X-PAYMENT V1 en vez de V2

```
PROBLEMA: "Failed to deserialize VerifyRequest" del facilitador.

V1 (INCORRECTO para facilitador V2):
{
  "x402Version": 1,
  "payload": { "signature": "0x..." }
}

V2 (CORRECTO):
{
  "x402Version": 2,
  "resource": { ... },     ← OBLIGATORIO: devolver del 402
  "accepted": { ... },     ← OBLIGATORIO: devolver del 402
  "payload": {
    "signature": "0x...",
    "authorization": { ... }
  }
}
```

### Error 4: Amount como numero en vez de string

```
PROBLEMA: BigInt errors o deserializacion fallida.

INCORRECTO: { "amount": 1000 }
CORRECTO:   { "amount": "1000" }

Tambien aplica para validAfter y validBefore en authorization:
INCORRECTO: { "validAfter": 0, "validBefore": 1739500000 }
CORRECTO:   { "validAfter": "0", "validBefore": "1739500000" }
```

### Error 5: Nonce reutilizado

```
PROBLEMA: "nonce already used" del facilitador.

CAUSA:   Reutilizar el mismo nonce en dos llamadas.

SOLUCION: Generar nonce aleatorio por cada llamada:
          const nonce = hexlify(randomBytes(32));
```

### Error 6: Firma expirada (validBefore en el pasado)

```
PROBLEMA: Firma rechazada silenciosamente.

CAUSA:   validBefore esta en el pasado o demasiado cercano.

SOLUCION: Usar al menos 1 hora de margen:
          const validBefore = Math.floor(Date.now() / 1000) + 3600;
```

### Error 7: Dominio EIP-712 incorrecto

```
PROBLEMA: "invalid signature" del facilitador.

CAUSA:   El dominio EIP-712 no coincide con el contrato USDC.

CORRECTO (tomar TODOS los valores del 402 response):
{
  name: accept.extra.name,                         // "USD Coin"
  version: accept.extra.version,                   // "2"
  chainId: parseInt(accept.network.split(':')[1]), // 43113
  verifyingContract: accept.asset,                 // contrato USDC
}

INCORRECTO (valores hardcodeados o inventados):
{
  name: "USDC",           // ← Incorrecto, debe ser "USD Coin"
  version: "1",            // ← Incorrecto, debe ser "2"
  chainId: "43113",        // ← Incorrecto, debe ser numero no string
  verifyingContract: "..."
}
```

### Error 8: USDC insuficiente

```
PROBLEMA: "insufficient_balance" o "insufficient allowance"

CAUSA:   La wallet del cliente no tiene suficiente USDC.

SOLUCION: Para testnet, fondear en https://faucet.circle.com
          Para mainnet, necesitas USDC real.
```

### Error 9: Tests unitarios con mocks ocultan bugs de formato

```
PROBLEMA: Tests pasan pero el facilitador real falla.

CAUSA:   Los mocks no validan el formato del wire protocol.
         Ejemplo: tu mock acepta { payload } pero el facilitador
         real necesita { paymentPayload, paymentRequirements }.

SOLUCION: Siempre tener al menos 1 test E2E contra testnet real.
          No confies solo en mocks para el formato del protocolo.
```

### Error 10: paymentRequirements != accepts (formato plano)

```
PROBLEMA: El facilitador rechaza el request.

DETALLE:
  - El header PAYMENT-REQUIRED tiene: { accepts: [...], resource: {...} }
  - Pero /verify y /settle necesitan paymentRequirements como OBJETO PLANO
    (solo el contenido de accepts[0], sin el array wrapper)

CORRECTO para /verify y /settle:
{
  "paymentRequirements": {
    "scheme": "exact",
    "network": "eip155:43113",
    "amount": "1000",
    ...
  }
}

INCORRECTO:
{
  "paymentRequirements": {
    "accepts": [{ ... }],    ← NO es un array
    "resource": { ... }      ← NO incluir resource aqui
  }
}
```

---

## 13. Referencia de Formatos JSON

### 402 Response (PAYMENT-REQUIRED header, base64)

```json
{
  "x402Version": 2,
  "accepts": [
    {
      "scheme": "exact",
      "network": "eip155:43113",
      "amount": "1000",
      "asset": "0x5425890298aed601595a70AB815c96711a31Bc65",
      "payTo": "0xTU_WALLET_AQUI",
      "maxTimeoutSeconds": 30,
      "extra": {
        "assetTransferMethod": "eip3009",
        "name": "USD Coin",
        "version": "2"
      }
    }
  ],
  "resource": {
    "url": "https://tu-api.com/api/analyze",
    "description": "AI Analysis Service",
    "mimeType": "application/json"
  },
  "error": "missing payment header"
}
```

### X-PAYMENT Request Header (base64)

```json
{
  "x402Version": 2,
  "resource": {
    "url": "https://tu-api.com/api/analyze",
    "description": "AI Analysis Service",
    "mimeType": "application/json"
  },
  "accepted": {
    "scheme": "exact",
    "network": "eip155:43113",
    "amount": "1000",
    "asset": "0x5425890298aed601595a70AB815c96711a31Bc65",
    "payTo": "0xTU_WALLET_AQUI",
    "maxTimeoutSeconds": 30,
    "extra": {
      "assetTransferMethod": "eip3009",
      "name": "USD Coin",
      "version": "2"
    }
  },
  "payload": {
    "signature": "0x...(65 bytes hex con prefijo 0x)...",
    "authorization": {
      "from": "0xWALLET_DEL_PAGADOR",
      "to": "0xTU_WALLET_AQUI",
      "value": "1000",
      "validAfter": "0",
      "validBefore": "1739500000",
      "nonce": "0x...(32 bytes hex aleatorios)..."
    }
  }
}
```

### Server → Facilitator /verify Request

```json
{
  "x402Version": 2,
  "paymentPayload": {
    "x402Version": 2,
    "resource": { "url": "...", "description": "...", "mimeType": "..." },
    "accepted": {
      "scheme": "exact",
      "network": "...",
      "amount": "...",
      "...": "..."
    },
    "payload": {
      "signature": "0x...",
      "authorization": {
        "from": "...",
        "to": "...",
        "value": "...",
        "...": "..."
      }
    }
  },
  "paymentRequirements": {
    "scheme": "exact",
    "network": "eip155:43113",
    "amount": "1000",
    "asset": "0x5425890298aed601595a70AB815c96711a31Bc65",
    "payTo": "0xTU_WALLET_AQUI",
    "maxTimeoutSeconds": 30,
    "extra": {
      "assetTransferMethod": "eip3009",
      "name": "USD Coin",
      "version": "2"
    }
  }
}
```

### Facilitator /verify Response

```json
// Exito:
{ "isValid": true, "payer": "0xWALLET_PAGADOR", "network": "eip155:43113" }

// Fallo:
{ "isValid": false, "invalidReason": "invalid signature" }
```

### Facilitator /settle Response

```json
// Exito:
{
  "success": true,
  "transaction": "0xABC123...",
  "network": "eip155:43113",
  "payer": "0xWALLET_PAGADOR"
}

// Fallo:
{ "success": false, "errorReason": "insufficient_balance" }
```

---

## 14. Variables de Entorno

### Servidor (tu API)

| Variable               | Ejemplo                                   | Descripcion                  |
| ---------------------- | ----------------------------------------- | ---------------------------- |
| `X402_PAY_TO`          | `0x7C599...Ae8`                           | Wallet que recibe pagos USDC |
| `X402_NETWORK`         | `eip155:43113`                            | Red (CAIP-2 format)          |
| `X402_ASSET_ADDRESS`   | `0x5425...Bc65`                           | Contrato USDC                |
| `X402_ASSET_NAME`      | `USD Coin`                                | Nombre del token (EIP-712)   |
| `X402_BASE_URL`        | `https://tu-api.com`                      | URL publica de tu API        |
| `X402_FACILITATOR_URL` | `https://facilitator.ultravioletadao.xyz` | URL del facilitador          |
| `X402_PRICE_DEFAULT`   | `0.001`                                   | Precio default en USD        |

### Cliente (para testing)

| Variable             | Ejemplo                             | Descripcion               |
| -------------------- | ----------------------------------- | ------------------------- |
| `WALLET_PRIVATE_KEY` | `0xabc...`                          | Clave privada del pagador |
| `API_URL`            | `http://localhost:3000/api/analyze` | URL del endpoint a probar |

---

## 15. Checklist de Implementacion

Usa este checklist para verificar que no falta nada:

### Servidor

- [ ] Crear `types.ts` con `PaymentRequirement`, `PaymentRequiredResponse`, `X402VerifyResult`, `X402SettleResult`
- [ ] Crear `config.ts` con todas las variables de entorno
- [ ] Crear `payment-required.ts` — genera respuesta 402 (USD -> micro-USDC)
- [ ] Crear `facilitator.ts` — llama `/verify` Y `/settle` al facilitador
- [ ] Verificar que `/settle` se llama DESPUES de `/verify` exitoso
- [ ] Verificar que el facilitador retorna `isValid` (no `valid`) y `invalidReason` (no `error`)
- [ ] Verificar que `/settle` retorna `success`, `transaction`, `errorReason`
- [ ] Crear `middleware.ts` — Express middleware que maneja 402 y X-PAYMENT
- [ ] Verificar que `amount` es **siempre string** en JSON
- [ ] Verificar que `extra` incluye `assetTransferMethod: "eip3009"`, `name`, `version`
- [ ] Configurar `.env` con `X402_PAY_TO` (tu wallet receptora)
- [ ] Conectar middleware a tus endpoints en `index.ts`
- [ ] Probar que GET `/health` responde 200 (no protegido)
- [ ] Probar que POST al endpoint protegido responde 402 sin auth

### Cliente (Testing)

- [ ] Instalar `ethers` v6+
- [ ] Crear wallet con USDC en Fuji (https://faucet.circle.com)
- [ ] Verificar balance USDC >= 0.001
- [ ] Llamar endpoint sin auth -> verificar HTTP 402
- [ ] Decodificar `PAYMENT-REQUIRED` header (base64 -> JSON)
- [ ] Construir dominio EIP-712 **desde los datos del 402** (no hardcodeados)
- [ ] Generar nonce aleatorio de 32 bytes
- [ ] Firmar con `wallet.signTypedData(domain, types, message)`
- [ ] Construir X-PAYMENT con `resource` + `accepted` del 402 (V2 obligatorio)
- [ ] Verificar que `validAfter` y `validBefore` son **strings** en X-PAYMENT
- [ ] Reintentar con `X-PAYMENT` header -> verificar HTTP 200
- [ ] Verificar transaccion en https://testnet.snowtrace.io

### Produccion

- [ ] Cambiar `X402_NETWORK` a `eip155:43114` (Avalanche mainnet)
- [ ] Cambiar `X402_ASSET_ADDRESS` a `0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E` (mainnet USDC)
- [ ] Cambiar `X402_BASE_URL` a tu URL de produccion
- [ ] Verificar que la wallet `X402_PAY_TO` es segura (idealmente hardware wallet)
- [ ] Agregar logging de pagos (payer, amount, tx hash, timestamp)
- [ ] Agregar timeout handling (30s para el facilitador)
- [ ] Considerar rate limiting por wallet
- [ ] Monitorear balance USDC recibido

---

## 16. Redes Soportadas

### Avalanche Fuji (Testnet) — Recomendado para desarrollo

| Parametro   | Valor                                        |
| ----------- | -------------------------------------------- |
| Chain ID    | `43113`                                      |
| CAIP-2      | `eip155:43113`                               |
| RPC         | `https://api.avax-test.network/ext/bc/C/rpc` |
| USDC        | `0x5425890298aed601595a70AB815c96711a31Bc65` |
| Decimales   | 6                                            |
| AVAX Faucet | https://faucet.avax.network                  |
| USDC Faucet | https://faucet.circle.com                    |
| Explorer    | https://testnet.snowtrace.io                 |

### Avalanche Mainnet (Produccion)

| Parametro | Valor                                        |
| --------- | -------------------------------------------- |
| Chain ID  | `43114`                                      |
| CAIP-2    | `eip155:43114`                               |
| RPC       | `https://api.avax.network/ext/bc/C/rpc`      |
| USDC      | `0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E` |
| Decimales | 6                                            |
| Explorer  | https://snowtrace.io                         |

### Otras redes EVM

El protocolo x402 funciona con cualquier red EVM donde USDC soporte EIP-3009 (`transferWithAuthorization`). Solo necesitas cambiar:

1. `X402_NETWORK` — formato CAIP-2 (`eip155:{chainId}`)
2. `X402_ASSET_ADDRESS` — contrato USDC en esa red
3. RPC URL del cliente

Redes comunes con USDC EIP-3009:

- Base: `eip155:8453` / USDC: `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`
- Polygon: `eip155:137` / USDC: `0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359`
- Ethereum: `eip155:1` / USDC: `0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48`

---

## Notas Finales

### Seguridad

- **El servidor NUNCA necesita claves privadas.** Solo recibe firmas y las envia al facilitador.
- **El cliente firma off-chain.** No gasta gas. El facilitador ejecuta on-chain.
- **Valida siempre server-side.** No confies en datos del cliente sin verificar con el facilitador.
- **Usa wallet dedicada** para `X402_PAY_TO`. No uses la misma wallet para otros propositos.

### Performance

- `/verify` toma ~500ms-2s (validacion de firma, no on-chain)
- `/settle` toma ~2s-10s (transaccion on-chain, depende de la red)
- Usa `AbortSignal.timeout(30_000)` para evitar hanging requests
- El facilitador de UltravioletaDAO es gratuito para el servidor (el costo lo paga el cliente en USDC)

### Recursos

- Facilitador: `https://facilitator.ultravioletadao.xyz`
- Protocolo x402: https://www.x402.org
- EIP-3009 (TransferWithAuthorization): https://eips.ethereum.org/EIPS/eip-3009
- EIP-712 (Typed Data Signing): https://eips.ethereum.org/EIPS/eip-712
- ethers.js v6: https://docs.ethers.org/v6/

---

> **Este documento fue generado a partir de la implementacion real** (751+ tests, E2E verificado on-chain en Avalanche Fuji). Cada error documentado fue encontrado y resuelto en produccion.
>
> Wolfcito @akawolfcito
