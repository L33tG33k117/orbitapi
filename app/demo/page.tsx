import type { Metadata } from 'next'
import { MissionPlayback } from './mission-playback'

export const metadata: Metadata = {
  title: 'OrbitAPI — live mission playback',
  description:
    'Watch OrbitAPI run real missions: security response, finance patrol, and support triage — with you as the human in the loop.',
}

// Public, full-screen animated demo. One continuous scene (orbit map +
// synced terminal), not a slideshow — the viewer even clicks the approval.
export default function DemoPage() {
  return <MissionPlayback />
}
