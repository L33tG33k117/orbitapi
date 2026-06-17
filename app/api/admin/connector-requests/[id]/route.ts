import { NextRequest, NextResponse } from 'next/server'
import { requireSuperAdmin } from '@/lib/admin-guard'
import { createAdminClient } from '@/lib/supabase/admin'
import { buildConnector } from '@/lib/build-connector'
import { createNotification } from '@/lib/notify'
import { applyConnectorBuild } from '@/lib/apply-connector-build'

// Allow up to 60 s — AI generation takes 15–30 s
export const maxDuration = 60

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireSuperAdmin()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const body = await req.json() as { status?: string; admin_notes?: string }

  const admin = createAdminClient()

  // Fetch the request (include user_id + workspace_id for notifications)
  const { data: request } = await admin
    .from('connector_requests')
    .select('id, connector_name, use_case, website_url, user_id, workspace_id')
    .eq('id', id)
    .single()

  const { data, error } = await admin
    .from('connector_requests')
    .update({ status: body.status, admin_notes: body.admin_notes, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('id, status, admin_notes')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  let build: Record<string, unknown> | null = null
  if (body.status === 'approved' && request) {
    const { data: buildRow } = await admin
      .from('connector_builds')
      .insert({ request_id: id, connector_name: request.connector_name, status: 'generating' })
      .select('id')
      .single()

    if (buildRow) {
      try {
        const result = await buildConnector(
          request.connector_name,
          request.use_case ?? null,
          request.website_url ?? null,
        )

        // If AI flagged the API as unvalidated, mark as failed with a clear message
        if (result.validated === false) {
          await admin.from('connector_builds').update({
            status: 'failed',
            error: `API validation failed: ${result.validation_message ?? 'Could not confirm this is a real public API'}`,
            updated_at: new Date().toISOString(),
          }).eq('id', buildRow.id)

          build = {
            id: buildRow.id,
            status: 'failed',
            error: `API validation failed: ${result.validation_message ?? 'Could not confirm this is a real public API'}`,
          }
        } else {
          const { data: updatedBuild } = await admin
            .from('connector_builds')
            .update({
              status: 'complete',
              connector_slug: result.slug,
              manifest_code: result.manifestCode,
              catalog_entry: result.catalogEntry,
              import_line: result.importLine,
              export_entry: result.exportEntry,
              logo_svg: result.logoSvg,
              updated_at: new Date().toISOString(),
            })
            .eq('id', buildRow.id)
            .select()
            .single()

          build = updatedBuild
          // Auto-apply: write files to disk so the connector appears immediately on next reload
          if (result.slug && result.manifestCode && result.catalogEntry && result.importLine && result.exportEntry) {
            try {
              applyConnectorBuild({
                slug: result.slug,
                connectorName: request.connector_name,
                manifestCode: result.manifestCode,
                catalogEntryStr: result.catalogEntry,
                importLine: result.importLine,
                exportEntry: result.exportEntry,
                logoSvg: result.logoSvg,
              })
            } catch (applyErr) {
              console.error('Auto-apply failed (files can be applied manually from admin panel):', applyErr)
            }
          }
          // Notify the requester that their connector is ready
          if (request.user_id && request.workspace_id) {
            await createNotification({
              workspaceId: request.workspace_id,
              userId: request.user_id,
              type: 'info',
              title: `"${request.connector_name}" connector is now available!`,
              body: 'Your requested connector has been built and added to the catalog.',
              link: '/connectors/requests',
            })
          }
        }
      } catch (err) {
        await admin.from('connector_builds').update({
          status: 'failed',
          error: String(err),
          updated_at: new Date().toISOString(),
        }).eq('id', buildRow.id)

        build = { id: buildRow.id, status: 'failed', error: String(err) }
      }
    }
  }

  return NextResponse.json({ ...data, build })
}
