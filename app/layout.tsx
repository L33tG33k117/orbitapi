import type { Metadata } from 'next'
import { Geist, Geist_Mono, Space_Grotesk } from 'next/font/google'
import './globals.css'
import { Toaster } from '@/components/ui/sonner'
import { ErrorReporter } from '@/components/error-reporter'
import { ThemeProvider } from '@/components/theme-provider'
import { ConfigProvider } from '@/components/config-provider'
import { getAppUrl } from '@/lib/app-url'
import { edition } from '@/lib/edition'

// Wire the actual CSS vars the theme references (--font-sans / --font-geist-mono / --font-heading).
const geist = Geist({ variable: '--font-sans', subsets: ['latin'] })
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] })
const spaceGrotesk = Space_Grotesk({ variable: '--font-space-grotesk', subsets: ['latin'] })

const DESCRIPTION =
  'AI agents that operate your tools. Connect 100+ APIs, command them in plain English, and launch autonomous skills — with approvals, audit trails, and a risk-free Simulated mode.'

export const metadata: Metadata = {
  metadataBase: new URL(getAppUrl()),
  title: { default: 'OrbitAPI — every API in your orbit', template: '%s' },
  description: DESCRIPTION,
  openGraph: {
    title: 'OrbitAPI — every API in your orbit',
    description: DESCRIPTION,
    siteName: 'OrbitAPI',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'OrbitAPI — every API in your orbit',
    description: DESCRIPTION,
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geist.variable} ${geistMono.variable} ${spaceGrotesk.variable} h-full antialiased`} suppressHydrationWarning>
      <body className="min-h-full flex flex-col">
        <ConfigProvider config={{ edition: edition(), appUrl: getAppUrl() }}>
          <ThemeProvider>
            {children}
            <ErrorReporter />
            <Toaster />
          </ThemeProvider>
        </ConfigProvider>
      </body>
    </html>
  )
}
