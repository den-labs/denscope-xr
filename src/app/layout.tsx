import type { Metadata } from 'next'
import { Space_Grotesk, Inter, JetBrains_Mono } from 'next/font/google'
import './globals.css'
import { Header } from '@/components/layout/Header'
import { StatusBar } from '@/components/layout/StatusBar'
import { PipelineProvider } from '@/components/providers/PipelineProvider'
import { WalletProvider } from '@/components/providers/WalletProvider'

const spaceGrotesk = Space_Grotesk({
  variable: '--font-display',
  subsets: ['latin'],
})

const inter = Inter({
  variable: '--font-sans',
  subsets: ['latin'],
})

const jetbrainsMono = JetBrains_Mono({
  variable: '--font-mono',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: 'DenScope — ERC-8004 Agent Explorer',
  description: 'Real-time explorer for ERC-8004 trustless agent identity and reputation',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className={`${spaceGrotesk.variable} ${inter.variable} ${jetbrainsMono.variable} flex h-screen flex-col bg-bg text-text-primary antialiased`}>
        <WalletProvider>
          <PipelineProvider>
            <Header />
            <main className="flex-1 overflow-hidden">{children}</main>
            <StatusBar />
          </PipelineProvider>
        </WalletProvider>
      </body>
    </html>
  )
}
