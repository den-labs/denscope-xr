import type { ReactNode } from 'react'

interface CornerFrameProps {
  children: ReactNode
  className?: string
  size?: number
}

export function CornerFrame({ children, className = '', size = 48 }: CornerFrameProps) {
  return (
    <div
      className={`corner-framed ${className}`}
      style={{ '--corner-size': `${size}px` } as React.CSSProperties}
    >
      {children}
    </div>
  )
}
