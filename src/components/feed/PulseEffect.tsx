'use client'

import { motion } from 'framer-motion'
import type { ReactNode } from 'react'

export function PulseEffect({ children }: { children: ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, backgroundColor: 'rgba(52, 211, 153, 0.08)' }}
      animate={{ opacity: 1, backgroundColor: 'rgba(52, 211, 153, 0)' }}
      transition={{ duration: 0.8, ease: 'easeOut' }}
    >
      {children}
    </motion.div>
  )
}
