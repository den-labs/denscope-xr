'use client'

import { useState, useRef, useCallback } from 'react'
import {
  useAccount,
  useChainId,
  useSwitchChain,
  useWriteContract,
  useWaitForTransactionReceipt,
} from 'wagmi'
import Link from 'next/link'
import { decodeEventLog } from 'viem'
import { chains } from '@/config/chains'
import { identityRegistryAbi } from '@/config/contracts'
import { uploadAgentMetadata } from '@/lib/ipfs/upload'

type Status = 'idle' | 'uploading' | 'signing' | 'confirming' | 'success' | 'error'

export function RegisterAgentPanel() {
  const { address } = useAccount()
  const currentChainId = useChainId()
  const { switchChainAsync } = useSwitchChain()
  const { writeContractAsync } = useWriteContract()
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>()

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [image, setImage] = useState('')
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [imageUploading, setImageUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [selectedChainId, setSelectedChainId] = useState(chains[0].id)
  const [status, setStatus] = useState<Status>('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const [agentId, setAgentId] = useState<string | null>(null)

  const handleImageFile = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setErrorMsg('File must be an image (PNG, JPG, WebP, GIF, SVG)')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setErrorMsg('Image must be under 5 MB')
      return
    }

    setErrorMsg('')
    setImagePreview(URL.createObjectURL(file))
    setImageUploading(true)

    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch('/api/ipfs/upload-file', {
        method: 'POST',
        body: formData,
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'Upload failed' }))
        throw new Error(data.error ?? 'Image upload failed')
      }
      const { uri } = await res.json()
      setImage(uri)
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Image upload failed')
      setImagePreview(null)
      setImage('')
    } finally {
      setImageUploading(false)
    }
  }, [])

  const { isLoading: isConfirming } = useWaitForTransactionReceipt({
    hash: txHash,
    query: {
      enabled: !!txHash,
      select(receipt) {
        for (const log of receipt.logs) {
          try {
            const decoded = decodeEventLog({
              abi: identityRegistryAbi,
              data: log.data,
              topics: log.topics,
            })
            if (decoded.eventName === 'Registered') {
              const id = (decoded.args as { agentId: bigint }).agentId.toString()
              setAgentId(id)
              setStatus('success')
              return receipt
            }
          } catch {
            // not our event, skip
          }
        }
        setStatus('success')
        return receipt
      },
    },
  })

  const selectedChain = chains.find((c) => c.id === selectedChainId)!

  async function handleRegister() {
    if (!address || !name.trim() || !description.trim()) return

    setErrorMsg('')
    setAgentId(null)
    setTxHash(undefined)

    try {
      // Upload metadata to IPFS
      setStatus('uploading')
      const uri = await uploadAgentMetadata({
        name: name.trim(),
        description: description.trim(),
        image: image.trim() || undefined,
        chainId: selectedChainId,
      })

      // Switch chain if needed
      if (currentChainId !== selectedChainId) {
        await switchChainAsync({ chainId: selectedChainId })
      }

      // Send register transaction
      setStatus('signing')
      const hash = await writeContractAsync({
        address: selectedChain.contracts.identity,
        abi: identityRegistryAbi,
        functionName: 'register',
        args: [uri],
        chainId: selectedChainId,
      })

      setTxHash(hash)
      setStatus('confirming')
    } catch (err) {
      console.error('Registration error:', err)
      setStatus('error')
      setErrorMsg(
        err instanceof Error ? err.message : 'Registration failed'
      )
    }
  }

  const isWorking = status === 'uploading' || status === 'signing' || status === 'confirming' || isConfirming

  return (
    <div className="bg-surface border border-border p-6 space-y-4">
      <h2 className="font-display text-lg font-bold uppercase tracking-wider text-text-primary">
        Register Agent
      </h2>
      <p className="text-xs text-text-muted font-mono">
        Register a new ERC-8004 agent on-chain. Metadata is uploaded to IPFS.
      </p>

      {status === 'success' ? (
        <div className="bg-background border border-accent p-4 space-y-2">
          <p className="text-sm font-mono text-accent font-bold">
            Agent registered successfully!
          </p>
          {agentId && (
            <Link
              href={`/agent/${selectedChainId}/${agentId}`}
              className="inline-block text-xs font-mono text-accent hover:underline"
            >
              View agent #{agentId} on {selectedChain.name}
            </Link>
          )}
          <div>
            <button
              onClick={() => {
                setStatus('idle')
                setName('')
                setDescription('')
                setImage('')
                setImagePreview(null)
                setAgentId(null)
                setTxHash(undefined)
              }}
              className="text-xs font-mono text-text-muted hover:underline mt-2"
            >
              Register another
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            <div>
              <label className="text-[10px] text-text-muted font-mono uppercase tracking-wider block mb-1">
                Name *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="My Agent"
                disabled={isWorking}
                className="w-full bg-background border border-border px-3 py-1.5 text-xs font-mono text-text-primary disabled:opacity-50"
              />
            </div>
            <div>
              <label className="text-[10px] text-text-muted font-mono uppercase tracking-wider block mb-1">
                Description *
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What does this agent do?"
                rows={3}
                disabled={isWorking}
                className="w-full bg-background border border-border px-3 py-1.5 text-xs font-mono text-text-primary resize-none disabled:opacity-50"
              />
            </div>
            <div>
              <label className="text-[10px] text-text-muted font-mono uppercase tracking-wider block mb-1">
                Image
              </label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) handleImageFile(file)
                }}
              />
              {imagePreview ? (
                <div className="flex items-center gap-3 bg-background border border-border p-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={imagePreview}
                    alt="Preview"
                    className="h-12 w-12 border border-border object-cover"
                  />
                  <div className="flex-1 min-w-0">
                    {imageUploading ? (
                      <p className="text-xs font-mono text-text-muted">Uploading to IPFS...</p>
                    ) : (
                      <p className="text-xs font-mono text-accent truncate">{image}</p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setImage('')
                      setImagePreview(null)
                      if (fileInputRef.current) fileInputRef.current.value = ''
                    }}
                    disabled={isWorking}
                    className="text-[10px] font-mono text-critical hover:underline disabled:opacity-50"
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => fileInputRef.current?.click()}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click() }}
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={(e) => {
                    e.preventDefault()
                    setDragOver(false)
                    const file = e.dataTransfer.files[0]
                    if (file) handleImageFile(file)
                  }}
                  onPaste={(e) => {
                    const file = e.clipboardData.files[0]
                    if (file) handleImageFile(file)
                  }}
                  className={`w-full bg-background border border-dashed px-3 py-4 text-center cursor-pointer transition-colors ${
                    dragOver ? 'border-accent text-accent' : 'border-border text-text-muted'
                  } ${isWorking ? 'opacity-50 pointer-events-none' : 'hover:border-accent hover:text-accent'}`}
                >
                  <p className="text-xs font-mono">
                    Drop image, paste, or click to browse
                  </p>
                  <p className="text-[10px] font-mono mt-1">
                    PNG, JPG, WebP, GIF, SVG &middot; Max 5 MB
                  </p>
                </div>
              )}
            </div>
            <div>
              <label className="text-[10px] text-text-muted font-mono uppercase tracking-wider block mb-1">
                Chain
              </label>
              <select
                value={selectedChainId}
                onChange={(e) => setSelectedChainId(Number(e.target.value))}
                disabled={isWorking}
                className="w-full bg-background border border-border px-3 py-1.5 text-xs font-mono text-text-primary disabled:opacity-50"
              >
                {chains.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {status === 'error' && (
            <p className="text-xs font-mono text-critical">{errorMsg}</p>
          )}

          <div className="flex items-center gap-3">
            <button
              onClick={handleRegister}
              disabled={isWorking || !name.trim() || !description.trim()}
              className="bg-accent text-bg px-4 py-1.5 text-xs font-mono font-bold hover:bg-accent/90 transition-colors disabled:opacity-50"
            >
              {status === 'uploading'
                ? 'Uploading to IPFS...'
                : status === 'signing'
                  ? 'Confirm in wallet...'
                  : status === 'confirming'
                    ? 'Confirming tx...'
                    : 'Register'}
            </button>
            {txHash && (
              <a
                href={`${selectedChain.explorer}/tx/${txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[10px] font-mono text-text-muted hover:underline"
              >
                View tx
              </a>
            )}
          </div>
        </>
      )}
    </div>
  )
}
