import type { ConnectorManifest } from './types'
import { simulatedLightsManifest } from './simulated-lights'
import { simulatedRingManifest } from './simulated-ring'
import { lodgifyManifest } from './lodgify'
import { slackManifest } from './slack'
import { pagerdutyManifest } from './pagerduty'
import { crowdstrikeManifest } from './crowdstrike'
import { twilioManifest } from './twilio'
import { sendgridManifest } from './sendgrid'
import { teamsManifest } from './teams'
import { servicenowManifest } from './servicenow'
import { netsuiteManifest } from './netsuite'
import { zendeskManifest } from './zendesk'
import { plainManifest } from './plain'
import { sophosManifest } from './sophos'
import { sentineloneManifest } from './sentinelone'
import { microsoftDefenderManifest } from './microsoft-defender'
import { stellarCyberManifest } from './stellar-cyber'

import { eufySecurityManifest } from './eufy-security'

import { quickbooksOnlineManifest } from './quickbooks-online'

import { googleDriveManifest } from './google-drive'

export const connectors: ConnectorManifest[] = [
  lodgifyManifest,
  slackManifest,
  pagerdutyManifest,
  crowdstrikeManifest,
  twilioManifest,
  sendgridManifest,
  teamsManifest,
  servicenowManifest,
  netsuiteManifest,
  zendeskManifest,
  plainManifest,
  sophosManifest,
  sentineloneManifest,
  microsoftDefenderManifest,
  stellarCyberManifest,
  eufySecurityManifest,
  quickbooksOnlineManifest,
  googleDriveManifest,
  simulatedLightsManifest,
  simulatedRingManifest,
]

export function getConnector(slug: string): ConnectorManifest | undefined {
  return connectors.find(c => c.slug === slug)
}

export { type ConnectorManifest } from './types'
