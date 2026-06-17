import Link from 'next/link'
import {
  LifeBuoy, MessageSquare, Plug, Layers, Zap, ShieldAlert, Shuffle, Package, Store,
  ClipboardCheck, Webhook, BookOpen, BarChart2, Gauge, ScrollText, Sparkles, ArrowRight,
} from 'lucide-react'

// ============================================================
// Help Guide — user-facing walkthrough of every section.
// KEEP THIS UPDATED: whenever a user-facing feature is added or
// changed, add/update its entry in SECTIONS below.
// ============================================================

interface Section {
  id: string
  title: string
  icon: React.ComponentType<{ className?: string }>
  what: string
  use: string
  example: string
  href?: string
  preview?: React.ReactNode
}

// A lightweight, on-theme visual stand-in for a screenshot.
function Preview({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border bg-muted/30 p-3 text-[11px] space-y-1.5 select-none">
      {children}
    </div>
  )
}
function Row({ label, tag, tagColor = 'bg-muted text-muted-foreground' }: { label: string; tag?: string; tagColor?: string }) {
  return (
    <div className="flex items-center gap-2 rounded-md bg-background border px-2 py-1.5">
      <span className="h-2 w-2 rounded-full bg-primary/50 shrink-0" />
      <span className="flex-1 truncate text-foreground/80">{label}</span>
      {tag && <span className={`px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase ${tagColor}`}>{tag}</span>}
    </div>
  )
}

const SECTIONS: Section[] = [
  {
    id: 'assistant', title: 'Orbit Assistant', icon: MessageSquare, href: '/chat',
    what: 'A chat where you talk to your connected apps in plain English. No code, no API knowledge needed.',
    use: 'When you want a quick answer or one-off action — "show me today\'s bookings" or "isolate host web-01".',
    example: '"Summarize this week\'s CrowdStrike detections and post the top 3 to Slack." Orbit reads the data and, for anything that changes something, asks you to confirm first.',
    preview: (
      <Preview>
        <div className="rounded-md bg-primary/15 text-foreground/80 px-2 py-1.5 ml-8">Summarize today&apos;s bookings</div>
        <div className="rounded-md bg-background border px-2 py-1.5 mr-8">3 check-ins today: Smith (2pm), Lee (4pm)…</div>
      </Preview>
    ),
  },
  {
    id: 'connectors', title: 'API Connectors', icon: Plug, href: '/connectors',
    what: 'A connector is a ready-made link to an app\'s API (Slack, Zendesk, CrowdStrike, …). Connecting one lets Orbit read and act in that app on your behalf.',
    use: 'Start here. Add the apps you want to automate. You can test any connector in Simulated mode with realistic fake data before entering real credentials.',
    example: 'Search "Slack" → Connect → paste your token (or click Simulate to try it with no token). Your credentials are stored encrypted and never sent to the AI.',
    preview: (
      <Preview>
        <Row label="Slack" tag="Connected" tagColor="bg-emerald-500/15 text-emerald-500" />
        <Row label="CrowdStrike" tag="Connect" />
        <Row label="Simulated Lights" tag="Simulated" tagColor="bg-violet-500/15 text-violet-500" />
      </Preview>
    ),
  },
  {
    id: 'groups', title: 'Groups', icon: Layers, href: '/groups',
    what: 'A named bundle of connections. Groups scope which apps a skill or playbook is allowed to touch.',
    use: 'Group the apps that belong to one job — e.g. a "Security" group with CrowdStrike + Slack + PagerDuty.',
    example: 'Create a "Support" group with Zendesk + Slack, then point a support skill at just that group.',
  },
  {
    id: 'skills', title: 'Skills', icon: Zap, href: '/skills',
    what: 'An AI agent with a job description (a "persona") that works across a group\'s apps. It figures out the steps itself.',
    use: 'When you want recurring, open-ended help — "triage new tickets every hour" — rather than a fixed sequence.',
    example: 'A "SOC Analyst" skill that queries your security tools, correlates threats, and posts a summary to Slack. Run it on demand or on a schedule.',
    preview: (
      <Preview>
        <Row label="SOC Analyst" tag="Supervised" tagColor="bg-amber-500/15 text-amber-500" />
        <Row label="Support Triage" tag="On" tagColor="bg-emerald-500/15 text-emerald-500" />
      </Preview>
    ),
  },
  {
    id: 'playbooks', title: 'Playbooks', icon: ShieldAlert, href: '/playbooks',
    what: 'A precise, multi-step automation with branching and a safety dial. Each step is one of: assess, action, condition, approval, notify, or wait.',
    use: 'When you need a repeatable, auditable response — and you want different behavior depending on how serious the situation is.',
    example: 'Detect a threat → score severity → if 9–10 auto-contain the host, if 6–8 ask a human to approve, if lower just notify. That severity dial is the Autonomy Policy.',
    preview: (
      <Preview>
        <Row label="1 · Assess detections" tag="severity 9" tagColor="bg-red-500/15 text-red-500" />
        <Row label="2 · Contain host" tag="auto" tagColor="bg-primary/15 text-primary" />
        <Row label="3 · Notify SOC" />
      </Preview>
    ),
  },
  {
    id: 'data-mapping', title: 'Data Mapping', icon: Shuffle, href: '/data-mapping',
    what: 'Sync records from one app to another. Orbit proposes how fields line up and shows a preview before anything runs.',
    use: 'When two apps should stay in step — e.g. mirror Zendesk tickets into ServiceNow incidents.',
    example: 'Pick source (Zendesk → list tickets) and target (ServiceNow → create incident). Orbit maps subject→short_description, etc., and previews the result against a real record.',
  },
  {
    id: 'bundles', title: 'Bundles', icon: Package, href: '/bundles',
    what: 'A ready-made solution pack — connectors, groups, playbooks, and skills — installed in one click. Expand any bundle to see exactly what\'s inside first.',
    use: 'The fastest way to get value. Install the Security SOC, Support Ops, or Property Management bundle and you have working automations immediately.',
    example: 'Click "See what\'s inside" on the Security SOC bundle to review its playbooks and connectors, then Install.',
  },
  {
    id: 'marketplace', title: 'Marketplace', icon: Store, href: '/marketplace',
    what: 'Community-published bundles you can install, plus a place to publish your own playbooks and skills (and earn a revenue share).',
    use: 'Find solutions others have built, or share yours. Published bundles are reviewed before they go live.',
    example: 'Publish your "Daily Threat Briefing" playbook — credentials are never included, only the recipe.',
  },
  {
    id: 'approvals', title: 'Approvals', icon: ClipboardCheck, href: '/approvals',
    what: 'A queue of actions waiting for your sign-off. Before approving something destructive, you see an AI impact preview and write a quick rollback plan.',
    use: 'This is your safety net — supervised skills and mid-severity playbook steps land here instead of running blindly.',
    example: '"Delete 3 records — cannot be undone." You review, jot how you\'d undo it, then Approve & Execute.',
  },
  {
    id: 'webhooks', title: 'Webhooks', icon: Webhook, href: '/webhooks',
    what: 'Inbound URLs that let outside apps trigger Orbit — run a skill, run a playbook, or wake a paused playbook waiting for an event.',
    use: 'When something elsewhere should kick off an automation (e.g. a booking webhook from Lodgify).',
    example: 'Create an endpoint, copy its URL + signing secret into the source app, and send a test payload to confirm it works.',
  },
  {
    id: 'reference', title: 'API Reference', icon: BookOpen, href: '/reference',
    what: 'A live list of every command available across your connected apps, with the parameters each takes — runnable right from the page.',
    use: 'When you want to see (or test) exactly what an app can do.',
    example: 'Find "Slack → send_message", fill in the channel and text, and run it in place.',
  },
  {
    id: 'usage', title: 'Usage', icon: BarChart2, href: '/usage',
    what: 'How much you\'re doing — action volume over time, by app, and by risk level.',
    use: 'To spot trends and see which apps and skills are busiest.',
    example: 'A 7-day chart of API calls with your top connectors listed below.',
  },
  {
    id: 'ai-power', title: 'AI Power', icon: Gauge, href: '/ai-power',
    what: 'The pool of AI Power your plan includes each month — every assistant, skill, and playbook draws from it. Pick how much horsepower they use (Economy, Balanced, or Maximum), and top up anytime.',
    use: 'To control how capable your automations are and how fast they use AI Power — and to add more when you need it.',
    example: 'Set high-volume skills to Economy to stretch your Power further, and Maximum for your most important playbook. Running low? Add a Power Pack or upgrade your plan.',
  },
  {
    id: 'audit', title: 'Audit Log', icon: ScrollText, href: '/audit',
    what: 'A complete record of every action — who or what ran it, the inputs, the response, and how long it took. Any action can be replayed.',
    use: 'For troubleshooting and compliance — and to re-run something with fresh data.',
    example: 'Expand an entry to see its full response, then click "Replay with fresh data".',
  },
  {
    id: 'plans', title: 'Plans & what\'s included', icon: Gauge, href: '/upgrade',
    what: 'Your plan decides which features are unlocked and how much AI Power you get. The Free plan includes the Orbit Assistant, API Connectors, and one manually-run Skill, with a one-time pool of trial credits so you can try it for real. Scheduling & autonomy, more Skills, Playbooks, Data Mapping, Bundles, Webhooks, Discover, and the full API Reference unlock on paid plans, which include a monthly AI Power allowance.',
    use: 'When a section shows a lock icon, that feature isn\'t on your current plan. You can still open it to see what it does — just click "Upgrade plan" to unlock it.',
    example: 'On Free, "Playbooks" appears greyed with a lock. Open it to preview, then upgrade to Pro to start building autonomous workflows. Have a promo code? Enter it at checkout.',
    preview: (
      <Preview>
        <Row label="Orbit Assistant" tag="Included" tagColor="bg-emerald-500/15 text-emerald-500" />
        <Row label="API Connectors" tag="Included" tagColor="bg-emerald-500/15 text-emerald-500" />
        <Row label="Playbooks" tag="Pro" tagColor="bg-violet-500/15 text-violet-500" />
        <Row label="Webhooks" tag="Pro" tagColor="bg-violet-500/15 text-violet-500" />
      </Preview>
    ),
  },
]

export default function GuidePage() {
  return (
    <div className="p-8 max-w-5xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2.5">
          <LifeBuoy className="h-7 w-7 text-primary" /> Help <span className="text-gradient">Guide</span>
        </h1>
        <p className="text-muted-foreground mt-2 max-w-2xl">
          OrbitAPI lets you use any app&apos;s API without writing code. Here&apos;s what every section does, when to
          reach for it, and a concrete example — in plain English.
        </p>
      </div>

      {/* Quick-start */}
      <div className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/[0.07] to-transparent p-6 mb-10">
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="h-4 w-4 text-primary" />
          <h2 className="font-semibold">New here? Start in three steps</h2>
        </div>
        <div className="grid sm:grid-cols-3 gap-4">
          {[
            { n: 1, t: 'Connect an app', d: 'Add an API connector (or try one in Simulated mode).', href: '/connectors' },
            { n: 2, t: 'Install a bundle', d: 'Get working playbooks & skills instantly.', href: '/bundles' },
            { n: 3, t: 'Run it', d: 'Trigger a playbook or just ask the Orbit Assistant.', href: '/chat' },
          ].map(s => (
            <Link key={s.n} href={s.href} className="group rounded-xl border bg-card p-4 hover:border-primary/40 transition-colors">
              <div className="h-7 w-7 rounded-full bg-gradient-to-br from-[var(--brand-from)] to-[var(--brand-to)] text-white flex items-center justify-center text-xs font-bold mb-2">{s.n}</div>
              <p className="font-semibold text-sm flex items-center gap-1">{s.t} <ArrowRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" /></p>
              <p className="text-xs text-muted-foreground mt-0.5">{s.d}</p>
            </Link>
          ))}
        </div>
      </div>

      <div className="flex gap-8">
        {/* Sticky table of contents */}
        <nav className="hidden lg:block w-44 shrink-0">
          <div className="sticky top-8 space-y-0.5">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground px-2 pb-1">Sections</p>
            {SECTIONS.map(s => (
              <a key={s.id} href={`#${s.id}`} className="block px-2 py-1 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                {s.title}
              </a>
            ))}
          </div>
        </nav>

        {/* Sections */}
        <div className="flex-1 min-w-0 space-y-5">
          {SECTIONS.map(s => {
            const Icon = s.icon
            return (
              <section key={s.id} id={s.id} className="scroll-mt-8 rounded-xl border bg-card p-5">
                <div className="flex items-center gap-2.5 mb-3">
                  <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Icon className="h-4 w-4 text-primary" />
                  </div>
                  <h2 className="font-semibold text-lg">{s.title}</h2>
                  {s.href && (
                    <Link href={s.href} className="ml-auto text-xs text-primary hover:underline inline-flex items-center gap-1">
                      Open <ArrowRight className="h-3 w-3" />
                    </Link>
                  )}
                </div>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2.5 text-sm">
                    <p><span className="font-medium">What it is.</span> <span className="text-muted-foreground">{s.what}</span></p>
                    <p><span className="font-medium">When to use it.</span> <span className="text-muted-foreground">{s.use}</span></p>
                    <p className="rounded-lg bg-muted/40 p-3 text-xs"><span className="font-semibold text-primary">Example.</span> <span className="text-muted-foreground">{s.example}</span></p>
                  </div>
                  {s.preview && <div className="self-start">{s.preview}</div>}
                </div>
              </section>
            )
          })}
        </div>
      </div>
    </div>
  )
}
