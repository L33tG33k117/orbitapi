'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useIsSelfHost } from '@/components/config-provider'
import { Orbit } from 'lucide-react'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const selfHost = useIsSelfHost()
  const [loading, setLoading] = useState(false)

  async function handleEmailLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) { setError(error.message); setLoading(false) }
    else { router.push('/dashboard'); router.refresh() }
  }

  async function handleGoogleLogin() {
    setLoading(true)
    const supabase = createClient()
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/api/auth/callback` },
    })
  }

  // Enterprise SSO/SAML. Routes the user to their org's IdP if a provider is
  // registered for their email domain in Supabase Auth (an admin/provider step).
  async function handleSSO() {
    setError(null)
    const domain = email.split('@')[1]?.trim()
    if (!domain) { setError('Enter your work email above, then choose SSO.'); return }
    setLoading(true)
    const supabase = createClient()
    const { data, error } = await supabase.auth.signInWithSSO({
      domain,
      options: { redirectTo: `${window.location.origin}/api/auth/callback` },
    })
    if (error) { setError(error.message); setLoading(false); return }
    if (data?.url) window.location.href = data.url
  }

  return (
    <div
      className="min-h-screen flex"
      style={{ background: 'oklch(0.07 0.02 268)' }}
    >
      {/* Left panel — branding */}
      <div className="hidden lg:flex flex-col justify-between w-96 shrink-0 p-10 border-r border-white/8">
        <Link href="/" className="flex items-center gap-2.5 w-fit hover:opacity-80 transition-opacity">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[oklch(0.46_0.19_264)]/20">
            <Orbit className="h-4 w-4 text-[oklch(0.7_0.2_264)]" />
          </div>
          <span className="font-bold text-white text-[15px]">OrbitAPI</span>
        </Link>
        <div className="space-y-4">
          <blockquote className="text-white/70 text-sm leading-relaxed italic">
            &ldquo;OrbitAPI lets our team query NetSuite, trigger alerts in Teams, and contain threats in CrowdStrike — all from one place.&rdquo;
          </blockquote>
          <p className="text-white/40 text-xs">— Security Operations Team</p>
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-sm space-y-8">
          {/* Mobile logo */}
          <Link href="/" className="flex lg:hidden items-center gap-2.5 justify-center hover:opacity-80 transition-opacity">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[oklch(0.46_0.19_264)]/20">
              <Orbit className="h-4 w-4 text-[oklch(0.7_0.2_264)]" />
            </div>
            <span className="font-bold text-white text-[15px]">OrbitAPI</span>
          </Link>

          <div>
            <h1 className="text-2xl font-bold text-white">Welcome back</h1>
            <p className="text-white/50 text-sm mt-1">Sign in to your workspace</p>
          </div>

          <div className="space-y-4">
            {/* Google and SAML both need the hosted auth service and a public
                redirect URL. Neither exists in the self-hosted build — OSS
                GoTrue has no SAML at all — so the buttons are hidden rather
                than shown and then failing at the redirect. */}
            {!selfHost && (
            <Button
              variant="outline"
              className="w-full bg-white/5 border-white/15 text-white hover:bg-white/10 hover:border-white/25 hover:text-white"
              onClick={handleGoogleLogin}
              disabled={loading}
            >
              <svg className="mr-2 h-4 w-4 shrink-0" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Continue with Google
            </Button>
            )}

            {!selfHost && (
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-white/10" />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="px-3 text-white/30" style={{ background: 'oklch(0.07 0.02 268)' }}>or</span>
              </div>
            </div>
            )}

            <form onSubmit={handleEmailLogin} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-white/70 text-sm">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@company.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  className="bg-white/5 border-white/15 text-white placeholder:text-white/25 focus:border-[oklch(0.56_0.2_264)] focus:ring-[oklch(0.56_0.2_264)]/20"
                />
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="text-white/70 text-sm">Password</Label>
                </div>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  className="bg-white/5 border-white/15 text-white placeholder:text-white/25 focus:border-[oklch(0.56_0.2_264)] focus:ring-[oklch(0.56_0.2_264)]/20"
                />
              </div>
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
                {loading ? 'Signing in…' : 'Sign in'}
              </Button>
            </form>

            {!selfHost && (
            <button
              type="button"
              onClick={handleSSO}
              disabled={loading}
              className="w-full text-center text-sm text-white/45 hover:text-white/80 transition-colors disabled:opacity-50"
            >
              Use single sign-on (SSO)
            </button>
            )}
          </div>

          {/* Self-hosted accounts are created by an administrator; public
              signup is disabled on the auth service, so a "create one" link
              would lead to a form that always fails. */}
          {selfHost ? (
          <p className="text-center text-sm text-white/40">
            Need an account? Ask your OrbitAPI administrator to create one for you.
          </p>
          ) : (
          <p className="text-center text-sm text-white/40">
            No account?{' '}
            <Link href="/signup" className="text-[oklch(0.72_0.18_264)] hover:text-[oklch(0.78_0.16_264)] transition-colors">
              Create one free
            </Link>
          </p>
          )}
        </div>
      </div>
    </div>
  )
}
