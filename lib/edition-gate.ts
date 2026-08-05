import { NextResponse } from 'next/server'
import { isSelfHost } from '@/lib/edition'

// ============================================================
// Edition gating — features that only exist in one edition
// ============================================================
// Distinct from capability gating, and the difference matters to the person
// reading the screen:
//
//   capability gate  "your plan doesn't include this"    → offer an upgrade
//   edition gate     "this doesn't exist in this build"  → do NOT offer an
//                    upgrade, because there is nothing to buy and the /upgrade
//                    page itself is one of the things that isn't there
//
// Sending a self-hosted admin to a Stripe checkout that can't reach the
// internet would be worse than simply not showing the feature.
//
// This module is deliberately JSX-free so API routes can import it without
// pulling React into their bundle. The page-level gate lives in
// components/edition-gate.tsx.
// ============================================================

/** Features that exist only in the hosted product. */
export type CloudOnlyFeature =
  | 'billing'        // plans, Stripe, top-ups
  | 'sso'            // SAML + social login (SAML is absent from OSS GoTrue)
  | 'marketing'      // the public marketing site
  | 'feedback'       // the in-app feedback board (support has no way to read it)
  | 'downloads'      // self-host release downloads live on the cloud site

export const CLOUD_ONLY_COPY: Record<CloudOnlyFeature, { label: string; description: string }> = {
  billing: {
    label: 'Billing',
    description: 'This installation is licensed directly, so there are no plans or payments to manage here.',
  },
  sso: {
    label: 'Single sign-on',
    description: 'Single sign-on is available on OrbitAPI Cloud. Accounts on this installation are managed by an administrator.',
  },
  marketing: {
    label: 'Not available',
    description: 'This page is only on orbitapi.com.',
  },
  feedback: {
    label: 'Feedback',
    description: 'Feedback sent from this installation would not reach us. Please contact your support channel instead.',
  },
  downloads: {
    label: 'Downloads',
    description: 'Updates are downloaded from your OrbitAPI account on the internet, then applied here offline.',
  },
}

/** True when a cloud-only feature should be unavailable in this build. */
export function isCloudOnlyUnavailable(): boolean {
  return isSelfHost()
}

/**
 * API-route guard. Mirrors capabilityGuard() from lib/workspace-features.ts:
 *   const denied = editionGuard('billing'); if (denied) return denied
 *
 * Returns 404, not 403: on a self-hosted box these endpoints genuinely do not
 * exist, and 403 would imply the caller might get in with better credentials,
 * which is misleading and invites retrying.
 */
export function editionGuard(feature: CloudOnlyFeature): NextResponse | null {
  if (!isSelfHost()) return null
  return NextResponse.json(
    { error: 'not_available', message: CLOUD_ONLY_COPY[feature].description },
    { status: 404 },
  )
}
