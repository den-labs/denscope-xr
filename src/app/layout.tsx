import type { Metadata } from 'next'
import { Space_Grotesk, Inter, JetBrains_Mono } from 'next/font/google'
import './globals.css'
import { siteUrl } from '@/config/site'
import { Header } from '@/components/layout/Header'
import { StatusBar } from '@/components/layout/StatusBar'
import { Analytics } from '@vercel/analytics/next'
import { ThemeProvider } from '@/components/providers/ThemeProvider'
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
  metadataBase: new URL(siteUrl()),
  title: 'DenScope — Trust Infrastructure for Autonomous Agents',
  description:
    'Compute trust signals, verify agent behavior, and expose the results through APIs and certificates.',
  openGraph: {
    title: 'DenScope — Trust Infrastructure for Autonomous Agents',
    description:
      'Compute trust signals, verify agent behavior, and expose the results through APIs and certificates.',
    images: [{ url: '/api/og', width: 1200, height: 630 }],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'DenScope — Trust Infrastructure for Autonomous Agents',
    description:
      'Compute trust signals, verify agent behavior, and expose the results through APIs and certificates.',
    images: ['/api/og'],
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${spaceGrotesk.variable} ${inter.variable} ${jetbrainsMono.variable} flex h-screen flex-col bg-bg text-text-primary antialiased`}>
        <ThemeProvider>
          <WalletProvider>
            <PipelineProvider>
              <Header />
              <main className="flex-1 overflow-hidden">{children}</main>
              <StatusBar />
            </PipelineProvider>
          </WalletProvider>
        </ThemeProvider>
        <Analytics />
      </body>
    </html>
  )
}
