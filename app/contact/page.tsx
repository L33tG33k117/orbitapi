'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Orbit, ArrowLeft, Mail, MessageSquare, Rocket } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function ContactPage() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [sent, setSent] = useState(false)
  const [sending, setSending] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSending(true)
    // In production, wire this to an email API (e.g. SendGrid)
    await new Promise(r => setTimeout(r, 800))
    setSending(false)
    setSent(true)
  }

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

      <div className="max-w-2xl mx-auto px-6 py-16">
        <div className="mb-10">
          <h1 className="text-3xl font-bold">Contact us</h1>
          <p className="text-white/45 mt-2">Questions, feedback, or partnership inquiries — we&apos;d love to hear from you.</p>
        </div>

        <div className="grid sm:grid-cols-3 gap-4 mb-12">
          {[
            { icon: Mail, title: 'Email', desc: 'hello@orbitapi.com', sub: 'We reply within 24h' },
            { icon: MessageSquare, title: 'Support', desc: 'support@orbitapi.com', sub: 'For technical issues' },
            { icon: Rocket, title: 'Enterprise', desc: 'sales@orbitapi.com', sub: 'Custom plans & onboarding' },
          ].map(c => {
            const Icon = c.icon
            return (
              <div key={c.title} className="rounded-xl border border-white/8 bg-[oklch(0.10_0.018_268)] p-5 space-y-2">
                <div className="h-8 w-8 rounded-lg bg-[oklch(0.46_0.19_264)]/15 flex items-center justify-center">
                  <Icon className="h-4 w-4 text-[oklch(0.7_0.2_264)]" />
                </div>
                <p className="font-semibold text-sm">{c.title}</p>
                <p className="text-xs text-[oklch(0.72_0.18_264)]">{c.desc}</p>
                <p className="text-xs text-white/35">{c.sub}</p>
              </div>
            )
          })}
        </div>

        {sent ? (
          <div className="rounded-2xl border border-green-500/20 bg-green-500/5 p-8 text-center space-y-3">
            <div className="h-12 w-12 rounded-full bg-green-500/10 flex items-center justify-center mx-auto">
              <Mail className="h-6 w-6 text-green-400" />
            </div>
            <h2 className="font-semibold text-lg">Message sent!</h2>
            <p className="text-white/50 text-sm">We&apos;ll get back to you at <span className="text-white">{email}</span> within 24 hours.</p>
            <Link href="/" className="inline-block text-sm text-[oklch(0.72_0.18_264)] hover:underline mt-2">
              Back to home
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5 rounded-2xl border border-white/8 bg-[oklch(0.10_0.018_268)] p-8">
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="name" className="text-white/60 text-sm">Name</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Jane Smith"
                  required
                  className="bg-white/5 border-white/15 text-white placeholder:text-white/20"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-white/60 text-sm">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  required
                  className="bg-white/5 border-white/15 text-white placeholder:text-white/20"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="message" className="text-white/60 text-sm">Message</Label>
              <textarea
                id="message"
                rows={5}
                value={message}
                onChange={e => setMessage(e.target.value)}
                placeholder="Tell us what you need, what you're building, or how we can help..."
                required
                className="w-full rounded-lg border border-white/15 bg-white/5 text-white placeholder:text-white/20 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[oklch(0.56_0.2_264)]/40 focus:border-[oklch(0.56_0.2_264)]"
              />
            </div>
            <Button
              type="submit"
              disabled={sending}
              className="w-full bg-[oklch(0.46_0.19_264)] hover:bg-[oklch(0.52_0.2_264)] text-white"
            >
              {sending ? 'Sending…' : 'Send message'}
            </Button>
          </form>
        )}
      </div>
    </div>
  )
}
