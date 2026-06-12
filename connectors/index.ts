import type { ConnectorManifest } from './types'
import { simulatedLightsManifest } from './simulated-lights'
import { lodgifyManifest } from './lodgify'

export const connectors: ConnectorManifest[] = [
  lodgifyManifest,
  simulatedLightsManifest,
]

export function getConnector(slug: string): ConnectorManifest | undefined {
  return connectors.find(c => c.slug === slug)
}

export { type ConnectorManifest } from './types'
