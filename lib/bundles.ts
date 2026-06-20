import { createAdminClient } from '@/lib/supabase/admin'
import type { PlaybookNode } from '@/lib/playbook-runner'

// ============================================================
// Foundation C — Bundle export / install primitive
// ============================================================
// One serialization format (BundleManifest) and one installer used by
// BOTH vertical bundles (#7, code-defined) and the marketplace (#4,
// row-defined). Installing a bundle provisions everything a vertical
// needs to run out of the box: simulated connections + groups +
// playbooks + skills, all tagged with the bundle slug so they can be
// uninstalled as a unit.
// ============================================================

export interface BundleConnector {
  /** Connector slug as registered in connectors/index.ts and the connectors table. */
  slug: string
  /** Label for the created connection (defaults to the connector name). */
  label?: string
  /** Human role this connector plays in the bundle, e.g. "EDR", "Team chat". */
  role?: string
  /** Other connector slugs that can fill this role (e.g. Sophos for CrowdStrike).
   *  Used by the bundle builder to let users reuse what they already have or pick
   *  a different vendor instead of being locked to the primary slug. */
  alternatives?: string[]
}

// How the installer should fulfil each bundle connector. Keyed by the bundle's
// DECLARED primary slug. Either reuse an existing connection or create one for a
// chosen connector slug (the primary or one of its alternatives).
export interface ConnectorResolution {
  /** Reuse this existing connection id (no new connection created). */
  connectionId?: string
  /** The connector slug actually chosen (primary or an alternative). */
  connectorSlug: string
}

export interface BundleGroup {
  /** Stable key used to wire playbooks/skills to this group within the manifest. */
  key: string
  name: string
  color?: string
  /** Connector slugs (from `connectors` above) that belong to this group. */
  connectorSlugs: string[]
}

export interface BundlePlaybook {
  name: string
  description?: string
  persona?: string
  groupKey: string
  definition: { steps: PlaybookNode[] }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  autonomy_policy?: any
  trigger_type?: 'manual' | 'schedule' | 'webhook' | 'event'
  schedule?: string | null
  enabled?: boolean
}

export interface BundleSkill {
  name: string
  description?: string
  persona?: string
  groupKey: string
  autonomy?: 'supervised' | 'autonomous'
}

export interface BundleManifest {
  slug: string
  name: string
  description: string
  category: string
  version: string
  connectors: BundleConnector[]
  groups: BundleGroup[]
  playbooks: BundlePlaybook[]
  skills: BundleSkill[]
  /** Optional seed data the bundle's demo connections rely on. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  demoData?: Record<string, any>
}

export interface InstallResult {
  installationId: string
  created: {
    connections: string[]
    groups: string[]
    playbooks: string[]
    skills: string[]
  }
  /** Connections created fresh by this install that still need credentials. */
  needsSetup: { connectionId: string; slug: string; name: string }[]
  /** Existing connections the install reused instead of duplicating. */
  reused: { connectionId: string; slug: string }[]
}

// Install a bundle into a workspace. Idempotent at the bundle level:
// if the bundle is already installed in this workspace it returns the
// existing installation rather than duplicating resources.
export async function installBundle(opts: {
  manifest: BundleManifest
  workspaceId: string
  userId: string
  source?: 'builtin' | 'marketplace'
  listingId?: string | null
  /** Per-connector choices from the bundle builder, keyed by declared primary slug. */
  resolutions?: Record<string, ConnectorResolution>
}): Promise<InstallResult> {
  const admin = createAdminClient()
  const { manifest, workspaceId, userId, resolutions } = opts

  // Guard: already installed?
  const { data: existing } = await admin
    .from('bundle_installations')
    .select('id, created_resources')
    .eq('workspace_id', workspaceId)
    .eq('bundle_slug', manifest.slug)
    .maybeSingle()
  if (existing) {
    return {
      installationId: existing.id,
      created: existing.created_resources as InstallResult['created'],
      needsSetup: [], reused: [],
    }
  }

  const created: InstallResult['created'] = { connections: [], groups: [], playbooks: [], skills: [] }
  const needsSetup: InstallResult['needsSetup'] = []
  const reused: InstallResult['reused'] = []
  // declared primary slug → the connector slug actually used (for playbook safety).
  const chosenByDeclared: Record<string, string> = {}

  // 1. Resolve each bundle connector. The builder may tell us to reuse an existing
  //    connection (no duplicate) or substitute an alternative vendor. Without a
  //    resolution we fall back to creating a fresh connection for the primary slug.
  const connBySlug: Record<string, string> = {}
  for (const c of manifest.connectors) {
    const res = resolutions?.[c.slug]

    // Reuse an existing connection the user already has.
    if (res?.connectionId) {
      const { data: existingConn } = await admin
        .from('connections')
        .select('id, connector:connectors(slug)')
        .eq('id', res.connectionId)
        .eq('workspace_id', workspaceId)
        .neq('status', 'trashed')
        .maybeSingle()
      if (existingConn) {
        connBySlug[c.slug] = existingConn.id
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        chosenByDeclared[c.slug] = (existingConn.connector as any)?.slug ?? c.slug
        reused.push({ connectionId: existingConn.id, slug: chosenByDeclared[c.slug] })
        continue
      }
    }

    // Otherwise create a fresh connection for the chosen connector (primary or alt).
    const chosenSlug = res?.connectorSlug ?? c.slug
    const { data: connector } = await admin
      .from('connectors')
      .select('id, name')
      .eq('slug', chosenSlug)
      .maybeSingle()
    if (!connector) continue // connector not registered — skip gracefully
    const { data: conn } = await admin
      .from('connections')
      .insert({
        workspace_id: workspaceId,
        connector_id: connector.id,
        label: c.label ?? connector.name,
        status: 'active',
        created_by: userId,
      })
      .select('id')
      .single()
    if (conn) {
      connBySlug[c.slug] = conn.id
      chosenByDeclared[c.slug] = chosenSlug
      created.connections.push(conn.id)
      needsSetup.push({ connectionId: conn.id, slug: chosenSlug, name: connector.name })
    }
  }

  // 2. Create groups and wire in their connections.
  const groupByKey: Record<string, string> = {}
  for (const g of manifest.groups) {
    const { data: group } = await admin
      .from('groups')
      .insert({ workspace_id: workspaceId, name: g.name, color: g.color ?? '#6366f1' })
      .select('id')
      .single()
    if (!group) continue
    groupByKey[g.key] = group.id
    created.groups.push(group.id)

    const links = g.connectorSlugs
      .map(slug => connBySlug[slug])
      .filter(Boolean)
      .map(connection_id => ({ group_id: group.id, connection_id }))
    if (links.length) await admin.from('group_connections').insert(links)
  }

  // 3. Create playbooks. Action steps in a manifest reference a connector by
  //    slug (connection ids don't exist until now) — remap to the created ids.
  for (const p of manifest.playbooks) {
    const remappedSteps = (p.definition?.steps ?? []).map(step => {
      const s = step as Record<string, unknown>
      if (s.connector_slug && !s.connection_id) {
        const declared = s.connector_slug as string
        // Only wire the connection when the user kept the same vendor — a
        // substitute (e.g. Sophos for CrowdStrike) has different action slugs,
        // so we leave it unset for the user to fix rather than fail at runtime.
        const sameVendor = chosenByDeclared[declared] === declared
        return { ...s, connection_id: sameVendor ? (connBySlug[declared] ?? null) : null }
      }
      return s
    })
    const { data: pb } = await admin
      .from('playbooks')
      .insert({
        workspace_id: workspaceId,
        group_id: groupByKey[p.groupKey] ?? null,
        name: p.name,
        description: p.description ?? null,
        persona: p.persona ?? '',
        definition: { steps: remappedSteps },
        autonomy_policy: p.autonomy_policy ?? undefined,
        trigger_type: p.trigger_type ?? 'manual',
        schedule: p.schedule ?? null,
        enabled: p.enabled ?? false,
        source: 'bundle',
        source_ref: manifest.slug,
        created_by: userId,
      })
      .select('id')
      .single()
    if (pb) created.playbooks.push(pb.id)
  }

  // 4. Create skills.
  for (const s of manifest.skills) {
    const { data: sk } = await admin
      .from('skills')
      .insert({
        workspace_id: workspaceId,
        group_id: groupByKey[s.groupKey] ?? null,
        name: s.name,
        description: s.description ?? null,
        persona: s.persona ?? '',
        autonomy: s.autonomy ?? 'supervised',
      })
      .select('id')
      .single()
    if (sk) created.skills.push(sk.id)
  }

  // 5. Record the installation.
  const { data: install } = await admin
    .from('bundle_installations')
    .insert({
      workspace_id: workspaceId,
      bundle_slug: manifest.slug,
      source: opts.source ?? 'builtin',
      listing_id: opts.listingId ?? null,
      created_resources: created,
      installed_by: userId,
    })
    .select('id')
    .single()

  if (opts.listingId) {
    await admin.rpc('increment_listing_installs', { p_listing_id: opts.listingId }).then(() => {}, () => {})
  }

  return { installationId: install?.id ?? '', created, needsSetup, reused }
}

// Remove everything a bundle installation created (best-effort, child-first).
export async function uninstallBundle(opts: {
  workspaceId: string
  bundleSlug: string
}): Promise<void> {
  const admin = createAdminClient()
  const { data: install } = await admin
    .from('bundle_installations')
    .select('id, created_resources')
    .eq('workspace_id', opts.workspaceId)
    .eq('bundle_slug', opts.bundleSlug)
    .maybeSingle()
  if (!install) return

  const r = install.created_resources as InstallResult['created']
  if (r.skills?.length) await admin.from('skills').delete().in('id', r.skills)
  if (r.playbooks?.length) await admin.from('playbooks').delete().in('id', r.playbooks)
  if (r.groups?.length) await admin.from('groups').delete().in('id', r.groups) // group_connections cascade
  if (r.connections?.length) await admin.from('connections').delete().in('id', r.connections)
  await admin.from('bundle_installations').delete().eq('id', install.id)
}

// Serialize existing workspace playbooks/skills into a publishable manifest (#4).
// Connections become connector references (no credentials are ever exported).
export async function exportBundle(opts: {
  workspaceId: string
  slug: string
  name: string
  description: string
  category: string
  playbookIds?: string[]
  skillIds?: string[]
}): Promise<BundleManifest> {
  const admin = createAdminClient()
  const manifest: BundleManifest = {
    slug: opts.slug,
    name: opts.name,
    description: opts.description,
    category: opts.category,
    version: '1.0.0',
    connectors: [],
    groups: [],
    playbooks: [],
    skills: [],
  }

  const connectorSlugs = new Set<string>()
  const groupKeyById: Record<string, string> = {}
  let groupCounter = 0

  // Helper: ensure a group + its connectors are captured, return its manifest key.
  async function captureGroup(groupId: string | null): Promise<string | undefined> {
    if (!groupId) return undefined
    if (groupKeyById[groupId]) return groupKeyById[groupId]
    const { data: group } = await admin
      .from('groups')
      .select('id, name, color, group_connections(connection_id)')
      .eq('id', groupId)
      .single()
    if (!group) return undefined
    const key = `group_${groupCounter++}`
    groupKeyById[groupId] = key

    const connIds = (group.group_connections ?? []).map((gc: { connection_id: string }) => gc.connection_id)
    const slugs: string[] = []
    if (connIds.length) {
      const { data: conns } = await admin
        .from('connections')
        .select('connector:connectors(slug)')
        .in('id', connIds)
      for (const c of (conns ?? []) as unknown as { connector: { slug: string } }[]) {
        slugs.push(c.connector.slug)
        connectorSlugs.add(c.connector.slug)
      }
    }
    manifest.groups.push({ key, name: group.name, color: group.color, connectorSlugs: slugs })
    return key
  }

  if (opts.playbookIds?.length) {
    const { data: pbs } = await admin.from('playbooks').select('*').in('id', opts.playbookIds)
    for (const p of pbs ?? []) {
      manifest.playbooks.push({
        name: p.name, description: p.description, persona: p.persona,
        groupKey: (await captureGroup(p.group_id)) ?? 'group_0',
        definition: p.definition, autonomy_policy: p.autonomy_policy,
        trigger_type: p.trigger_type, schedule: p.schedule,
      })
    }
  }

  if (opts.skillIds?.length) {
    const { data: sks } = await admin.from('skills').select('*').in('id', opts.skillIds)
    for (const s of sks ?? []) {
      manifest.skills.push({
        name: s.name, description: s.description, persona: s.persona,
        groupKey: (await captureGroup(s.group_id)) ?? 'group_0',
        autonomy: s.autonomy,
      })
    }
  }

  manifest.connectors = [...connectorSlugs].map(slug => ({ slug }))
  return manifest
}
