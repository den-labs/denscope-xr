import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css'
import { Header } from '@/components/layout/Header'
import { StatusBar } from '@/components/layout/StatusBar'
import { PipelineProvider } from '@/components/providers/PipelineProvider'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: 'DenScope — ERC-8004 Agent Explorer',
  description: 'Real-time explorer for ERC-8004 trustless agent identity and reputation',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className={`${geistSans.variable} ${geistMono.variable} flex h-screen flex-col bg-zinc-950 text-white antialiased`}>
        <PipelineProvider>
          <Header />
          <main className="flex-1 overflow-hidden">{children}</main>
          <StatusBar />
        </PipelineProvider>
      </body>
    </html>
  )
}
