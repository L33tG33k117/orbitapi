// Nudges people to make a skill's persona specific to their business.
//
// Bundle and template personas are deliberately generic ("You are an AI
// onboarding concierge..."). They run, but they don't know the product, the
// tone, or what must always be said. This checks for those pieces with simple
// keyword heuristics and offers a fill-in-the-blanks block. Pure module.

export interface PersonaCheck {
  key: 'business' | 'audience' | 'tone' | 'facts' | 'handoff'
  label: string
  covered: boolean
  tip: string
}

const RULES: { key: PersonaCheck['key']; label: string; tip: string; words: RegExp }[] = [
  { key: 'business', label: 'Your business', tip: 'Name your company and what you sell, so answers are about YOUR product.',
    words: /\b(our (company|product|platform|service|business|app)|we (sell|offer|provide|make|run)|company:|product:|about (us|our))\b/i },
  { key: 'audience', label: 'Who it talks to', tip: 'Say who the customers are (e.g. small property managers, IT admins).',
    words: /\b(customers? (are|is)|our (customers|clients|users|guests)|audience|customers?:|clients?:)\b/i },
  { key: 'tone', label: 'Tone & style', tip: 'Describe how it should sound (friendly, brief, formal, no jargon...).',
    words: /\b(tone|voice|style|friendly|formal|casual|concise|plain language|jargon)\b/i },
  { key: 'facts', label: 'Must-say details', tip: 'List facts it should always include: links, hours, next steps, policies.',
    words: /\b(always (mention|include|share|link)|key (facts|links|info)|must (mention|include)|help center|docs? (link|url)|https?:\/\/)/i },
  { key: 'handoff', label: 'When to hand off', tip: 'Say when a person must take over (refunds, legal, angry customers...).',
    words: /\b(escalat\w*|hand ?off|hand it to|human should|never (promise|agree|offer)|do not (promise|offer)|don'?t (promise|offer))\b/i },
]

export function checkPersona(persona: string): PersonaCheck[] {
  const text = persona ?? ''
  return RULES.map(r => ({ key: r.key, label: r.label, tip: r.tip, covered: r.words.test(text) }))
}

/** Unfilled "[...]" placeholders left from the template. */
export function personaPlaceholders(persona: string): string[] {
  return [...(persona ?? '').matchAll(/\[([^\]\n]{3,80})\]/g)].map(m => m[1])
}

/** Fill-in block appended to a persona. Only adds sections that are missing. */
export function personaTemplate(missing: PersonaCheck['key'][]): string {
  const parts: string[] = []
  if (missing.includes('business') || missing.includes('audience')) {
    parts.push('## About our business')
    if (missing.includes('business')) parts.push('- Our company / product: [what you sell, in one or two sentences]')
    if (missing.includes('audience')) parts.push('- Our customers are: [who they are and what they care about]')
  }
  if (missing.includes('tone') || missing.includes('facts')) {
    parts.push('', '## How to engage')
    if (missing.includes('tone')) parts.push('- Tone: [e.g. warm and concise, plain language, no jargon]')
    if (missing.includes('facts')) parts.push('- Always mention: [key links, support hours, next steps]')
  }
  if (missing.includes('handoff')) {
    parts.push('', '## When to hand off to a person')
    parts.push('- Escalate to a human when: [e.g. refunds, legal questions, upset customers]')
    parts.push('- Never promise: [e.g. discounts, delivery dates, anything needing approval]')
  }
  return parts.join('\n').trim()
}
