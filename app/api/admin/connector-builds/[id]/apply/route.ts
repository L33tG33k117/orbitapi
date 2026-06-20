import { NextRequest, NextResponse } from 'next/server'
import { requireSuperAdmin } from '@/lib/admin-guard'
import { createAdminClient } from '@/lib/supabase/admin'
import { applyConnectorBuild, registerConnectorRow } from '@/lib/apply-connector-build'

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireSuperAdmin()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const admin = createAdminClient()

  const { data: build } = await admin
    .from('connector_builds')
    .select('id, connector_slug, connector_name, status, manifest_code, catalog_entry, import_line, export_entry, logo_svg, simulated_data')
    .eq('id', id)
    .single()

  if (!build) return NextResponse.json({ error: 'Build not found' }, { status: 404 })
  if (build.status !== 'complete') return NextResponse.json({ error: 'Build is not complete' }, { status: 400 })
  if (!build.manifest_code || !build.catalog_entry || !build.import_line || !build.export_entry) {
    return NextResponse.json({ error: 'Build data incomplete' }, { status: 400 })
  }

  const result = applyConnectorBuild({
    slug: build.connector_slug!,
    connectorName: build.connector_name,
    manifestCode: build.manifest_code,
    catalogEntryStr: build.catalog_entry,
    importLine: build.import_line,
    exportEntry: build.export_entry,
    logoSvg: build.logo_svg,
    simulatedData: (build.simulated_data as Record<string, unknown> | null) ?? null,
  })

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 500 })
  }

  // Seed the `connectors` DB row. Without this the connector shows in the
  // catalog (from code) but can't be connected — /api/connections looks up
  // connectors.id for the connection FK and 404s with "Connector not found
  // in database". Built connectors are always real (non-simulated).
  const { error: seedErr } = await registerConnectorRow(admin, result.meta)
  if (seedErr) {
    return NextResponse.json({ error: `Files written but DB seed failed: ${seedErr.message}` }, { status: 500 })
  }

  // Persist applied_at so the admin panel shows correct state across page loads
  await admin
    .from('connector_builds')
    .update({ applied_at: new Date().toISOString() })
    .eq('id', id)

  return NextResponse.json({ ok: true, filesWritten: result.filesWritten })
}
