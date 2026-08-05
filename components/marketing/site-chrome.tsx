import Link from 'next/link'
import { Orbit, Rocket } from 'lucide-react'

// Shared nav + footer for public marketing pages (/integrations, /solutions,
// /changelog). The landing page keeps its own inline chrome — keep link lists
// in sync when adding pages.

export function MarketingNav() {
  return (
    <nav className="fixed top-0 inset-x-0 z-50 border-b border-white/8 backdrop-blur-md bg-[oklch(0.07_0.02_268)]/80">
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[oklch(0.46_0.19_264)]/20">
            <Orbit className="h-4 w-4 text-[oklch(0.7_0.2_264)]" />
          </div>
          <span className="font-bold text-[15px] tracking-tight text-white">OrbitAPI</span>
        </Link>
        <div className="hidden sm:flex items-center gap-6 text-sm text-white/50">
          <Link href="/#how-it-works" className="hover:text-white transition-colors">How it works</Link>
          <Link href="/integrations" className="hover:text-white transition-colors">Integrations</Link>
          <Link href="/solutions" className="hover:text-white transition-colors">Solutions</Link>
          <Link href="/self-hosted" className="hover:text-white transition-colors">Self-hosted</Link>
          <Link href="/#pricing" className="hover:text-white transition-colors">Pricing</Link>
          <Link href="/changelog" className="hover:text-white transition-colors">Changelog</Link>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/login" className="text-sm text-white/60 hover:text-white transition-colors">
            Sign in
          </Link>
          <Link
            href="/signup"
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[oklch(0.46_0.19_264)] text-white text-sm font-medium hover:bg-[oklch(0.52_0.2_264)] transition-colors"
          >
            Launch free <Rocket className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </nav>
  )
}

export function MarketingFooter() {
  return (
    <footer className="border-t border-white/6 py-12 px-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col sm:flex-row items-start justify-between gap-8 mb-10">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[oklch(0.46_0.19_264)]/20">
                <Orbit className="h-3.5 w-3.5 text-[oklch(0.7_0.2_264)]" />
              </div>
              <span className="text-sm font-bold text-white">OrbitAPI</span>
            </div>
            <p className="text-xs text-white/35 max-w-xs leading-relaxed">
              Mission control for your modern tech stack. Connect, automate, and command your APIs with AI.
            </p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-8 text-sm">
            <div className="space-y-3">
              <p className="text-white/20 text-xs uppercase tracking-widest font-semibold">Product</p>
              <div className="space-y-2">
                <Link href="/integrations" className="block text-white/45 hover:text-white transition-colors">Integrations</Link>
                <Link href="/solutions" className="block text-white/45 hover:text-white transition-colors">Solutions</Link>
                <Link href="/self-hosted" className="block text-white/45 hover:text-white transition-colors">Self-hosted</Link>
                <Link href="/#pricing" className="block text-white/45 hover:text-white transition-colors">Pricing</Link>
                <Link href="/changelog" className="block text-white/45 hover:text-white transition-colors">Changelog</Link>
                <Link href="/demo" className="block text-white/45 hover:text-white transition-colors">15-second demo</Link>
              </div>
            </div>
            <div className="space-y-3">
              <p className="text-white/20 text-xs uppercase tracking-widest font-semibold">Account</p>
              <div className="space-y-2">
                <Link href="/login" className="block text-white/45 hover:text-white transition-colors">Sign in</Link>
                <Link href="/signup" className="block text-white/45 hover:text-white transition-colors">Create account</Link>
              </div>
            </div>
            <div className="space-y-3">
              <p className="text-white/20 text-xs uppercase tracking-widest font-semibold">Legal</p>
              <div className="space-y-2">
                <Link href="/privacy" className="block text-white/45 hover:text-white transition-colors">Privacy policy</Link>
                <Link href="/terms" className="block text-white/45 hover:text-white transition-colors">Terms of service</Link>
                <Link href="/contact" className="block text-white/45 hover:text-white transition-colors">Contact us</Link>
              </div>
            </div>
          </div>
        </div>
        <div className="border-t border-white/6 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-white/25">© 2026 OrbitAPI. All rights reserved.</p>
          <p className="text-xs text-white/20">Built for the teams that keep the world running.</p>
        </div>
      </div>
    </footer>
  )
}
