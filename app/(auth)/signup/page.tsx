'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Orbit, CheckCircle } from 'lucide-react'

export default function SignupPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [workspaceName, setWorkspaceName] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [inviteRequired, setInviteRequired] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetch('/api/auth/signup-config')
      .then(r => r.json())
      .then(d => setInviteRequired(!!d.inviteRequired))
      .catch(() => {})
  }, [])

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const res = await fetch('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, fullName, workspaceName, inviteCode }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) { setError(data.error ?? 'Something went wrong. Please try again.'); setLoading(false) }
    else { setSuccess(true) }
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={{ background: 'oklch(0.07 0.02 268)' }}>
        <div className="text-center space-y-4 max-w-sm">
          <div className="flex justify-center">
            <div className="h-14 w-14 rounded-full bg-[oklch(0.46_0.19_264)]/15 flex items-center justify-center">
              <CheckCircle className="h-7 w-7 text-[oklch(0.7_0.2_264)]" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-white">Check your email</h1>
          <p className="text-white/50 text-sm leading-relaxed">
            We sent a confirmation link to <span className="text-white">{email}</span>. Click it to activate your account and workspace.
          </p>
          <Link href="/login" className="inline-block text-sm text-[oklch(0.72_0.18_264)] hover:text-[oklch(0.78_0.16_264)] transition-colors">
            Back to sign in
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex" style={{ background: 'oklch(0.07 0.02 268)' }}>
      {/* Left panel */}
      <div className="hidden lg:flex flex-col justify-between w-96 shrink-0 p-10 border-r border-white/8">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[oklch(0.46_0.19_264)]/20">
            <Orbit className="h-4 w-4 text-[oklch(0.7_0.2_264)]" />
          </div>
          <span className="font-bold text-white text-[15px]">OrbitAPI</span>
        </div>
        <div className="space-y-6">
          {[
            'Connect 100+ APIs in minutes',
            'AI-powered automation with full audit trail',
            'Cross-connector workflows — NetSuite → Teams → CrowdStrike',
          ].map(f => (
            <div key={f} className="flex items-start gap-3">
              <CheckCircle className="h-4 w-4 text-[oklch(0.65_0.18_264)] shrink-0 mt-0.5" />
              <span className="text-white/60 text-sm">{f}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-sm space-y-8">
          <div className="flex lg:hidden items-center gap-2.5 justify-center">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[oklch(0.46_0.19_264)]/20">
              <Orbit className="h-4 w-4 text-[oklch(0.7_0.2_264)]" />
            </div>
            <span className="font-bold text-white text-[15px]">OrbitAPI</span>
          </div>

          <div>
            <h1 className="text-2xl font-bold text-white">Create your account</h1>
            <p className="text-white/50 text-sm mt-1">Free to start — no credit card required</p>
          </div>

          <form onSubmit={handleSignup} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="fullName" className="text-white/70 text-sm">Full name</Label>
                <Input
                  id="fullName"
                  placeholder="Jane Smith"
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                  required
                  className="bg-white/5 border-white/15 text-white placeholder:text-white/25 focus:border-[oklch(0.56_0.2_264)]"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="workspaceName" className="text-white/70 text-sm">Workspace</Label>
                <Input
                  id="workspaceName"
                  placeholder="My Company"
                  value={workspaceName}
                  onChange={e => setWorkspaceName(e.target.value)}
                  required
                  className="bg-white/5 border-white/15 text-white placeholder:text-white/25 focus:border-[oklch(0.56_0.2_264)]"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-white/70 text-sm">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@company.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                className="bg-white/5 border-white/15 text-white placeholder:text-white/25 focus:border-[oklch(0.56_0.2_264)]"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-white/70 text-sm">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="8+ characters"
                minLength={8}
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                className="bg-white/5 border-white/15 text-white placeholder:text-white/25 focus:border-[oklch(0.56_0.2_264)]"
              />
            </div>
            {inviteRequired && (
              <div className="space-y-1.5">
                <Label htmlFor="inviteCode" className="text-white/70 text-sm">Invite code</Label>
                <Input
                  id="inviteCode"
                  placeholder="Enter your beta invite code"
                  value={inviteCode}
                  onChange={e => setInviteCode(e.target.value)}
                  required
                  className="bg-white/5 border-white/15 text-white placeholder:text-white/25 focus:border-[oklch(0.56_0.2_264)]"
                />
                <p className="text-[11px] text-white/30">OrbitAPI is in private beta. You need an invite code to join.</p>
              </div>
            )}
            {error && (
              <div className="rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2">
                <p className="text-sm text-red-400">{error}</p>
              </div>
            )}
            <Button
              type="submit"
              className="w-full bg-[oklch(0.46_0.19_264)] hover:bg-[oklch(0.52_0.2_264)] text-white font-medium"
              disabled={loading}
            >
              {loading ? 'Creating account…' : 'Create free account'}
            </Button>
            <p className="text-center text-[11px] text-white/25">
              By signing up you agree to our Terms of Service and Privacy Policy.
            </p>
          </form>

          <p className="text-center text-sm text-white/40">
            Already have an account?{' '}
            <Link href="/login" className="text-[oklch(0.72_0.18_264)] hover:text-[oklch(0.78_0.16_264)] transition-colors">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
