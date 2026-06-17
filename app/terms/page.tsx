import Link from 'next/link'
import { Orbit, ArrowLeft } from 'lucide-react'

export default function TermsPage() {
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
          <h1 className="text-3xl font-bold">Terms of Service</h1>
          <p className="text-white/40 text-sm mt-2">Last updated: June 2026</p>
        </div>

        <div className="space-y-6 text-white/70 text-sm leading-relaxed">
          <section className="space-y-3">
            <h2 className="text-base font-semibold text-white">1. Acceptance</h2>
            <p>By creating an account or using OrbitAPI, you agree to these Terms of Service. If you do not agree, do not use the service.</p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-semibold text-white">2. Use of the service</h2>
            <p>OrbitAPI provides tools to connect, query, and automate third-party APIs. You are responsible for ensuring your use of connected APIs complies with those APIs&apos; own terms of service. You may not use OrbitAPI for illegal activities, unauthorized access to systems, or to violate any third party&apos;s rights.</p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-semibold text-white">3. API credentials and security</h2>
            <p>You are responsible for maintaining the security of API credentials you provide to OrbitAPI. You should only connect APIs you have authorization to access. OrbitAPI encrypts your credentials but cannot be held liable for actions taken by AI skills you configure and enable.</p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-semibold text-white">4. Autonomous skills</h2>
            <p>Autonomous skills execute actions without manual approval. You are responsible for reviewing skill configurations before enabling them and for any actions they take on connected APIs. OrbitAPI is a tool — ultimate responsibility for API actions rests with you.</p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-semibold text-white">5. Limitation of liability</h2>
            <p>OrbitAPI is provided &quot;as is.&quot; We are not liable for any damages arising from use of the service, including data loss, API errors, or actions taken by AI skills. Our liability is limited to the amount you paid for the service in the past 3 months.</p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-semibold text-white">6. Termination</h2>
            <p>We may suspend or terminate your account for violations of these terms. You may delete your account at any time from workspace settings.</p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-semibold text-white">7. Changes</h2>
            <p>We may update these terms. Material changes will be communicated by email. Continued use after changes constitutes acceptance.</p>
          </section>
        </div>
      </div>
    </div>
  )
}
