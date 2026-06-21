import type { Metadata } from 'next'
import { ExplainerReel } from './explainer-reel'

export const metadata: Metadata = {
  title: 'OrbitAPI — in 15 seconds',
  description: 'A short animated explainer of OrbitAPI: connect every API, command it in plain English, and let it run autonomously.',
}

// Standalone, public, full-screen explainer reel — built to be played
// full-screen and screen-recorded into a shareable clip.
export default function DemoPage() {
  return <ExplainerReel />
}
