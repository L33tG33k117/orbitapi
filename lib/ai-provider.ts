// ============================================================
// AI provider factory — Claude, or a model the customer runs themselves
// ============================================================
// Orbit has ~11 places that call an LLM. Before this module every one of them
// did `anthropic('claude-...')` directly, which hardcoded three assumptions:
// the vendor, the model catalogue, and that tokens cost money.
//
// The self-hosted (offline) edition breaks all three: an air-gapped customer
// runs their own model on their own hardware, reachable only on their LAN.
// So every call site now asks THIS module what to run on:
//
//     const provider = await resolveAiProvider(workspaceId)
//     const result = await generateText({ model: provider.model('claude-opus-5'), ... })
//
// The model id passed in is a HINT, not a command. On Anthropic it's used
// as-is (today's exact behaviour). On a local provider there is only one
// configured model, so the hint is ignored — the whole efficiency mapping
// (maximum/balanced/economy) collapses to "the model you installed".
//
// Precedence, highest first:
//   1. A workspace's own ai_provider_settings row — cloud, gated behind the
//      `byo_llm` capability so it can't be self-served on the hosted plan.
//   2. Instance-level env (ORBIT_AI_BASE_URL) — how the self-hosted package
//      configures itself before anyone has logged in.
//   3. Anthropic. The default for the hosted product, always.
//
// Server-only: reads the database and decrypts a stored API key.
// ============================================================

import { anthropic } from '@ai-sdk/anthropic'
import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import type { LanguageModel } from 'ai'
import { createAdminClient } from '@/lib/supabase/admin'
import { readSecret } from '@/lib/credentials'
import { isSelfHost } from '@/lib/edition'
import { hasCapability, type FeatureOverrides } from '@/lib/entitlements'
import { localModelId, type AnyModelId, type ModelId } from '@/lib/usage-cost'
import type { WorkspaceTier } from '@/types'

export type AiProviderKind = 'anthropic' | 'local'

/** Default ceiling for a local model's reply — overridable per workspace. */
const DEFAULT_LOCAL_MAX_TOKENS = 8_192

export interface AiProvider {
  kind: AiProviderKind
  /**
   * The model to hand to generateText/streamText. `hint` is the model the call
   * site would have picked on Anthropic; local providers ignore it.
   */
  model(hint?: ModelId | string): LanguageModel
  /**
   * What to RECORD for this call — billing, run history, usage charts. Local
   * models come back as `local:<name>` so downstream cost math returns $0
   * without needing to know which edition it's running in.
   */
  billingModelId(hint?: ModelId | string): AnyModelId
  /**
   * Clamp an intended output budget to what this provider can actually do.
   * A 32k agentic budget is fine on Claude and impossible on most local
   * models, which would simply error or truncate.
   */
  clampMaxTokens(desired: number): number
  /** Anthropic-only features (thinking, prompt caching) — off for local. */
  supportsThinking: boolean
  supportsPromptCache: boolean
  /** Human label for admin screens and error copy. */
  label: string
}

interface LocalSettings {
  baseUrl: string
  modelName: string
  apiKey?: string
  maxOutputTokens?: number | null
}

// ------------------------------------------------------------
// The Anthropic provider — today's behaviour, unchanged
// ------------------------------------------------------------

const DEFAULT_HINT: ModelId = 'claude-sonnet-5'

function anthropicProvider(): AiProvider {
  return {
    kind: 'anthropic',
    label: 'Claude (Anthropic)',
    model: (hint) => anthropic((hint ?? DEFAULT_HINT) as string),
    billingModelId: (hint) => (hint ?? DEFAULT_HINT) as AnyModelId,
    clampMaxTokens: (desired) => desired,
    supportsThinking: true,
    supportsPromptCache: true,
  }
}

// ------------------------------------------------------------
// The local provider — an OpenAI-compatible endpoint on the customer's network
// ------------------------------------------------------------
// Ollama, LM Studio, vLLM, llama.cpp and text-generation-webui all expose an
// OpenAI-shaped /v1 API, so one adapter covers every realistic target. The
// API key is optional: most local servers don't authenticate at all, but some
// customers front theirs with a reverse proxy that does.

function localProvider(settings: LocalSettings): AiProvider {
  const client = createOpenAICompatible({
    name: 'orbit-local',
    baseURL: settings.baseUrl,
    ...(settings.apiKey ? { apiKey: settings.apiKey } : {}),
  })
  const cap = settings.maxOutputTokens ?? DEFAULT_LOCAL_MAX_TOKENS

  return {
    kind: 'local',
    label: settings.modelName,
    // The hint is deliberately dropped: there is exactly one local model.
    model: () => client(settings.modelName),
    billingModelId: () => localModelId(settings.modelName),
    clampMaxTokens: (desired) => Math.min(desired, cap),
    supportsThinking: false,
    supportsPromptCache: false,
  }
}

// ------------------------------------------------------------
// Resolution
// ------------------------------------------------------------

/** Instance-level local config, used by the self-hosted package. */
function envLocalSettings(): LocalSettings | null {
  const baseUrl = process.env.ORBIT_AI_BASE_URL
  const modelName = process.env.ORBIT_AI_MODEL
  if (!baseUrl || !modelName) return null
  const max = Number(process.env.ORBIT_AI_MAX_OUTPUT_TOKENS)
  return {
    baseUrl,
    modelName,
    apiKey: process.env.ORBIT_AI_API_KEY || undefined,
    maxOutputTokens: Number.isFinite(max) && max > 0 ? max : null,
  }
}

/**
 * Read a workspace's configured local provider, if it has one AND is entitled
 * to use it. Returns null for the overwhelmingly common case (hosted workspace,
 * no row) so the caller falls through to Anthropic.
 *
 * Never throws: if the settings table doesn't exist yet (migration not applied)
 * or the query fails, we quietly fall back to Claude rather than taking the
 * whole app's AI down.
 */
async function workspaceLocalSettings(workspaceId: string): Promise<LocalSettings | null> {
  try {
    const admin = createAdminClient()

    const { data: row, error } = await admin
      .from('ai_provider_settings')
      .select('base_url, model_name, api_key_secret_id, max_output_tokens, enabled')
      .eq('workspace_id', workspaceId)
      .maybeSingle()

    if (error || !row || !row.enabled || !row.base_url || !row.model_name) return null

    // Entitlement is checked HERE rather than at the settings screen alone, so
    // a stale row left behind by a downgrade stops taking effect immediately.
    const { data: ws } = await admin
      .from('workspaces')
      .select('tier, feature_flags')
      .eq('id', workspaceId)
      .maybeSingle()

    const entitled =
      isSelfHost() ||
      hasCapability(
        (ws?.tier ?? null) as WorkspaceTier | null,
        (ws?.feature_flags ?? null) as FeatureOverrides | null,
        'byo_llm',
      )
    if (!entitled) return null

    const secret = row.api_key_secret_id ? await readSecret(row.api_key_secret_id) : null

    return {
      baseUrl: row.base_url,
      modelName: row.model_name,
      apiKey: secret?.api_key || undefined,
      maxOutputTokens: row.max_output_tokens,
    }
  } catch {
    return null
  }
}

/**
 * The one entry point. Every AI call site in the app goes through this.
 *
 * `workspaceId` is optional because a couple of call sites (connector
 * discovery, connector building) run outside a workspace context; those get
 * the instance default.
 */
export async function resolveAiProvider(workspaceId?: string | null): Promise<AiProvider> {
  if (workspaceId) {
    const ws = await workspaceLocalSettings(workspaceId)
    if (ws) return localProvider(ws)
  }
  const env = envLocalSettings()
  if (env) return localProvider(env)
  return anthropicProvider()
}

/**
 * Build a provider directly from unsaved settings — used by the "Test
 * connection" button so an admin can verify an endpoint before committing it.
 */
export function providerFromSettings(settings: LocalSettings): AiProvider {
  return localProvider(settings)
}
