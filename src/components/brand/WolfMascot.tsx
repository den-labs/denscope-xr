import Image from 'next/image'

interface WolfMascotProps {
  variant?: 'idle' | 'loading' | 'empty'
  size?: number
  className?: string
}

export function WolfMascot({ variant = 'idle', size = 64, className = '' }: WolfMascotProps) {
  return (
    <div className={`flex flex-col items-center gap-2 ${className}`}>
      <Image
        src="/denscope-logo.png"
        alt="DenScope Wolf"
        width={size}
        height={size}
        className="opacity-40 dark:invert dark:opacity-30"
      />
      {variant === 'loading' && (
        <span className="text-[11px] text-foreground-muted animate-pulse">
          Processing...
        </span>
      )}
      {variant === 'empty' && (
        <span className="text-[11px] text-foreground-muted">
          Nothing here yet
        </span>
      )}
    </div>
  )
}
