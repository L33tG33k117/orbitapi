import Link from 'next/link'
import { Orbit, ArrowLeft } from 'lucide-react'

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[oklch(0.07_0.02_268)] text-white">
      <nav className="border-b border-white/8 px-6 h-16 flex items-center justify-between max-w-4xl mx-auto">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[oklch(0.46_0.19_264)]/20">
            <Orbit className="h-3.5 w-3.5 text-[oklch(0.7_0.2_264)]" />
          </div>
          <span className="font-bold text-sm">OrbitAPI</span>
        </Link>
        <Link href="/" className="flex items-center gap-1.5 text-sm text-white/50 hover:text-white transition-colors">
          <ArrowLeft className="h-3.5 w-3.5" /> Back
        </Link>
      </nav>

      <div className="max-w-3xl mx-auto px-6 py-16 space-y-8">
        <div>
          <h1 className="text-3xl font-bold">Privacy Policy</h1>
          <p className="text-white/40 text-sm mt-2">Last updated: June 2026</p>
        </div>

        <div className="space-y-6 text-white/70 text-sm leading-relaxed">
          <section className="space-y-3">
            <h2 className="text-base font-semibold text-white">1. Information we collect</h2>
            <p>When you create an account, we collect your email address, name, and workspace name. When you connect APIs, we store your API credentials encrypted in our secure vault (Supabase Vault). We also log actions executed through OrbitAPI for audit purposes.</p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-semibold text-white">2. How we use your information</h2>
            <p>We use your information solely to operate the OrbitAPI service — authenticating your account, executing API actions on your behalf, and providing audit logs. We do not sell, share, or use your data for advertising.</p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-semibold text-white">3. API credentials</h2>
            <p>All API credentials you provide are encrypted at rest using Supabase Vault. Credentials are only decrypted in memory at execution time and are never logged or stored in plain text. You can delete any connection at any time to permanently remove its credentials.</p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-semibold text-white">4. Data retention</h2>
            <p>Audit logs are retained for 90 days by default. Conversation history is retained until you delete it. You can delete your workspace at any time, which permanently removes all associated data.</p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-semibold text-white">5. Third-party services</h2>
            <p>OrbitAPI is built on Supabase (database and auth), Anthropic (AI), and Vercel (hosting). Each processes data according to their own privacy policies. We do not share your connected API credentials with these providers.</p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-semibold text-white">6. Contact</h2>
            <p>For privacy questions or data deletion requests, contact us at <Link href="/contact" className="text-[oklch(0.72_0.18_264)] hover:underline">our contact page</Link>.</p>
          </section>
        </div>
      </div>
    </div>
  )
}
