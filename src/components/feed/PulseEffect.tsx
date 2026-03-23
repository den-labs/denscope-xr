'use client'

import { motion } from 'framer-motion'
import type { ReactNode } from 'react'

export function PulseEffect({ children }: { children: ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.8, ease: 'easeOut' }}
      className="animate-pulse-bg"
    >
      {children}
    </motion.div>
  )
}
