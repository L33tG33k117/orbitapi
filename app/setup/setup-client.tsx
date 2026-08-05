'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Orbit, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createClient } from '@/lib/supabase/client'

// Three steps, and the third is skippable on purpose: simulated connectors
// work with no AI at all, so a customer whose model server isn't ready yet
// should still reach a working product rather than being stuck at a form they
// can't complete.
type Step = 'account' | 'ai' | 'done'

export function SetupClient() {
  const router = useRouter()
  const [step, setStep] = useState<Step>('account')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Step 1 — administrator + workspace
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [workspaceName, setWorkspaceName] = useState('')

  // Step 2 — the customer's own model
  const [baseUrl, setBaseUrl] = useState('')
  const [modelName, setModelName] = useState('')
  const [testState, setTestState] = useState<'idle' | 'testing' | 'ok' | 'fail'>('idle')
  const [testMsg, setTestMsg] = useState('')

  async function createAccount(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (password !== confirm) { setError('The two passwords do not match.'); return }

    setBusy(true)
    const res = await fetch('/api/setup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, fullName, workspaceName }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) { setError(data.error ?? 'Could not create the account.'); setBusy(false); return }

    // Sign in immediately so the AI step (and everything after) is authenticated.
    const supabase = createClient()
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
    setBusy(false)
    if (signInError) {
      // The account exists, so send them to log in rather than losing the work.
      router.push('/login')
      return
    }
    setStep('ai')
  }

  async function testConnection() {
    setTestState('testing')
    setTestMsg('')
    const res = await fetch('/api/ai-provider/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ baseUrl, modelName }),
    })
    const data = await res.json().catch(() => ({}))
    if (data.ok) { setTestState('ok'); setTestMsg(`Connected in ${(data.ms / 1000).toFixed(1)}s.`) }
    else { setTestState('fail'); setTestMsg(data.error ?? 'Could not reach that address.') }
  }

  async function saveAi() {
    setBusy(true)
    setError(null)
    const res = await fetch('/api/ai-provider', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ baseUrl, modelName, enabled: true }),
    })
    setBusy(false)
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setError(data.error ?? 'Could not save those settings.')
      return
    }
    setStep('done')
  }

  function finish() {
    router.push('/dashboard')
    router.refresh()
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ background: 'oklch(0.07 0.02 268)' }}>
      <div className="w-full max-w-md space-y-8">
        <div className="flex items-center gap-2.5 justify-center">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[oklch(0.46_0.19_264)]/20">
            <Orbit className="h-4 w-4 text-[oklch(0.7_0.2_264)]" />
          </div>
          <span className="font-bold text-white text-[15px]">OrbitAPI</span>
        </div>

        <Steps step={step} />

        {step === 'account' && (
          <form onSubmit={createAccount} className="space-y-4">
            <div>
              <h1 className="text-2xl font-bold text-white">Set up OrbitAPI</h1>
              <p className="text-white/50 text-sm mt-1">
                This creates the administrator account for this installation. You&apos;ll use it to
                add everyone else.
              </p>
            </div>

            <Field label="Your name" id="fullName" value={fullName} onChange={setFullName} placeholder="Alex Morgan" required />
            <Field label="Email" id="email" type="email" value={email} onChange={setEmail} placeholder="you@company.com" required />
            <Field
              label="Password" id="password" type="password" value={password} onChange={setPassword} required
              hint="At least 12 characters. There may be no way to email you a reset from this server, so store it somewhere safe."
            />
            <Field label="Confirm password" id="confirm" type="password" value={confirm} onChange={setConfirm} required />
            <Field label="Workspace name" id="workspaceName" value={workspaceName} onChange={setWorkspaceName} placeholder="Acme Operations" required />

            {error && <ErrorBox>{error}</ErrorBox>}

            <Button type="submit" disabled={busy} className="w-full bg-[oklch(0.46_0.19_264)] hover:bg-[oklch(0.52_0.2_264)] text-white font-medium">
              {busy ? 'Creating…' : 'Create administrator'}
            </Button>
          </form>
        )}

        {step === 'ai' && (
          <div className="space-y-4">
            <div>
              <h1 className="text-2xl font-bold text-white">Connect your AI model</h1>
              <p className="text-white/50 text-sm mt-1">
                OrbitAPI runs on an AI model you host yourself, so your data never leaves your
                network. You can skip this and set it up later.
              </p>
            </div>

            <Field
              label="Model server address" id="baseUrl" value={baseUrl} onChange={setBaseUrl}
              placeholder="http://192.168.1.50:11434/v1"
              hint="Ollama, LM Studio and vLLM all provide one. It usually ends in /v1."
            />
            <Field
              label="Model name" id="modelName" value={modelName} onChange={setModelName}
              placeholder="llama3.1:70b"
              hint="We recommend a recent 30B+ instruct model with tool calling."
            />

            {testMsg && (
              <p className={`text-sm ${testState === 'ok' ? 'text-emerald-400' : 'text-red-400'}`}>{testMsg}</p>
            )}
            {error && <ErrorBox>{error}</ErrorBox>}

            <div className="flex gap-2">
              <Button
                type="button" variant="outline" onClick={testConnection}
                disabled={!baseUrl || !modelName || testState === 'testing'}
                className="bg-white/5 border-white/15 text-white hover:bg-white/10 hover:text-white"
              >
                {testState === 'testing' ? 'Testing…' : 'Test'}
              </Button>
              <Button
                type="button" onClick={saveAi} disabled={busy || !baseUrl || !modelName}
                className="flex-1 bg-[oklch(0.46_0.19_264)] hover:bg-[oklch(0.52_0.2_264)] text-white font-medium"
              >
                {busy ? 'Saving…' : 'Save and continue'}
              </Button>
            </div>

            <button type="button" onClick={() => setStep('done')} className="w-full text-center text-sm text-white/45 hover:text-white/80 transition-colors">
              Skip for now
            </button>
            <p className="text-center text-xs text-white/30">
              Simulated connectors work without any AI, so you can explore first.
            </p>
          </div>
        )}

        {step === 'done' && (
          <div className="space-y-5 text-center">
            <div className="mx-auto w-12 h-12 rounded-full bg-emerald-500/15 flex items-center justify-center">
              <Check className="h-6 w-6 text-emerald-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">You&apos;re ready</h1>
              <p className="text-white/50 text-sm mt-1">
                OrbitAPI is set up. Connect your first app, or try a simulated one to see how it works.
              </p>
            </div>
            <div className="rounded-xl border border-amber-500/25 bg-amber-500/5 p-4 text-left">
              <p className="text-sm font-medium text-amber-300">One thing before you go</p>
              <p className="text-xs text-white/60 mt-1 leading-relaxed">
                Back up the <code className="font-mono">.env</code> file on this server. It holds the
                key that decrypts every stored credential, and it cannot be regenerated — without it,
                every connection would have to be set up again from scratch.
              </p>
            </div>
            <Button onClick={finish} className="w-full bg-[oklch(0.46_0.19_264)] hover:bg-[oklch(0.52_0.2_264)] text-white font-medium">
              Go to OrbitAPI
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}

function Steps({ step }: { step: Step }) {
  const order: Step[] = ['account', 'ai', 'done']
  const labels: Record<Step, string> = { account: 'Account', ai: 'AI model', done: 'Done' }
  const current = order.indexOf(step)
  return (
    <div className="flex items-center gap-2">
      {order.map((s, i) => (
        <div key={s} className="flex-1">
          <div className={`h-1 rounded-full ${i <= current ? 'bg-[oklch(0.6_0.2_264)]' : 'bg-white/10'}`} />
          <p className={`text-[11px] mt-1.5 ${i <= current ? 'text-white/70' : 'text-white/30'}`}>{labels[s]}</p>
        </div>
      ))}
    </div>
  )
}

function Field({
  label, id, value, onChange, type = 'text', placeholder, required, hint,
}: {
  label: string; id: string; value: string; onChange: (v: string) => void
  type?: string; placeholder?: string; required?: boolean; hint?: string
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-white/70 text-sm">{label}</Label>
      <Input
        id={id} type={type} value={value} onChange={e => onChange(e.target.value)}
        placeholder={placeholder} required={required} autoComplete="off"
        className="bg-white/5 border-white/15 text-white placeholder:text-white/25 focus:border-[oklch(0.56_0.2_264)] focus:ring-[oklch(0.56_0.2_264)]/20"
      />
      {hint && <p className="text-[11px] text-white/35">{hint}</p>}
    </div>
  )
}

function ErrorBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2">
      <p className="text-sm text-red-400">{children}</p>
    </div>
  )
}
