import type { Metadata } from 'next'
import { ExplainerDiagram } from './explainer-diagram'

export const metadata: Metadata = {
  title: 'How OrbitAPI works',
  description: 'A live concept diagram: one command flows into Orbit, which calls every connected app and returns the results.',
}

// Standalone, public, full-screen animated "how it works" concept diagram.
export default function HowItWorksPage() {
  return <ExplainerDiagram />
}
