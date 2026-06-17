import type { ConnectorManifest, ActionResult } from '@/connectors/types'

const SLACK_API = 'https://slack.com/api'

async function slackPost(apiKey: string, path: string, body: Record<string, unknown>): Promise<ActionResult> {
  const res = await fetch(`${SLACK_API}${path}`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) return { ok: false, error: `HTTP ${res.status}` }
  const data = await res.json()
  if (!data.ok) return { ok: false, error: data.error ?? 'Slack API error' }
  return { ok: true, data }
}

async function slackGet(apiKey: string, path: string): Promise<ActionResult> {
  const res = await fetch(`${SLACK_API}${path}`, {
    headers: { 'Authorization': `Bearer ${apiKey}` },
  })
  if (!res.ok) return { ok: false, error: `HTTP ${res.status}` }
  const data = await res.json()
  if (!data.ok) return { ok: false, error: data.error ?? 'Slack API error' }
  return { ok: true, data }
}

export const slackManifest: ConnectorManifest = {
  slug: 'slack',
  name: 'Slack',
  category: 'Communication',
  description: 'Send messages, post rich cards, manage channels, react, search, and schedule messages across your Slack workspace.',
  logoUrl: '/logos/slack.svg',
  isSimulated: false,

  auth: {
    type: 'api_key',
    keyLabel: 'Bot Token',
    keyPlaceholder: 'xoxb-...',
    keyHint: 'Create a Slack app with scopes: chat:write, channels:read, channels:manage, channels:history, channels:write, users:read, reactions:write, search:read, pins:read, files:write. Install and paste the Bot User OAuth Token.',
    setupGuide: [
      {
        title: 'Create a Slack app',
        description:
          'Go to **api.slack.com/apps**, click **Create New App → From scratch**, ' +
          'name it "OrbitAPI", and pick your workspace.',
      },
      {
        title: 'Add Bot Token Scopes',
        description:
          'Under **OAuth & Permissions → Bot Token Scopes**, add: ' +
          '**chat:write, channels:read, channels:manage, channels:history, channels:write, ' +
          'users:read, reactions:write, search:read, pins:read, files:write**.',
      },
      {
        title: 'Install and copy token',
        description:
          'Click **Install to Workspace**, authorize, then copy the **Bot User OAuth Token** (starts with xoxb-). ' +
          'Invite the bot to channels with /invite @YourApp.',
      },
    ],
  },

  testConnection: async (creds) => {
    const res = await fetch(`${SLACK_API}/auth.test`, {
      headers: { 'Authorization': `Bearer ${creds.api_key}` },
    })
    const data = await res.json()
    if (!data.ok) return { ok: false, error: data.error ?? 'Invalid token' }
    return { ok: true, label: `${data.team} / ${data.user}` }
  },

  actions: [
    {
      slug: 'send_message',
      name: 'Send Message',
      description:
        'Post a plain-text message to a Slack channel. ' +
        'channel must be the channel ID (e.g. C01234ABCDE) or channel name with #. ' +
        'Optionally reply in a thread by providing thread_ts.',
      risk: 'write',
      inputSchema: {
        type: 'object',
        required: ['channel', 'text'],
        properties: {
          channel: { type: 'string', description: 'Channel ID or #channel-name' },
          text: { type: 'string', description: 'Message text (markdown supported)' },
          thread_ts: { type: 'string', description: 'Thread timestamp to reply in thread (optional)' },
        },
      },
      execute: async (creds, params) => {
        return slackPost(creds.api_key, '/chat.postMessage', {
          channel: params.channel,
          text: params.text,
          ...(params.thread_ts ? { thread_ts: params.thread_ts } : {}),
        })
      },
    },
    {
      slug: 'send_alert',
      name: 'Send Alert',
      description:
        'Post a structured alert to a Slack channel with a title, body, and severity colour. ' +
        'severity must be one of: good, warning, danger.',
      risk: 'write',
      inputSchema: {
        type: 'object',
        required: ['channel', 'title', 'severity'],
        properties: {
          channel: { type: 'string', description: 'Channel ID or #channel-name' },
          title: { type: 'string', description: 'Alert title' },
          body: { type: 'string', description: 'Alert body text (optional)' },
          severity: { type: 'string', enum: ['good', 'warning', 'danger'], description: 'Colour: good=green, warning=yellow, danger=red' },
        },
      },
      execute: async (creds, params) => {
        return slackPost(creds.api_key, '/chat.postMessage', {
          channel: params.channel,
          attachments: [{
            color: params.severity as string,
            title: params.title as string,
            text: (params.body as string | undefined) ?? '',
            ts: Math.floor(Date.now() / 1000),
          }],
        })
      },
    },
    {
      slug: 'list_channels',
      name: 'List Channels',
      description: 'List public and private Slack channels the bot has access to. Returns channel ID, name, and member count.',
      risk: 'read',
      inputSchema: {
        type: 'object',
        properties: {
          limit: { type: 'number', description: 'Max channels to return (default 50, max 200)' },
        },
      },
      execute: async (creds, params) => {
        const limit = Math.min((params.limit as number | undefined) ?? 50, 200)
        const res = await slackGet(creds.api_key, `/conversations.list?limit=${limit}&types=public_channel,private_channel`)
        if (!res.ok) return res
        type SlackChannel = { id: string; name: string; num_members: number; is_private: boolean }
        const channels = ((res.data as { channels: SlackChannel[] }).channels ?? [])
        return {
          ok: true,
          data: channels.map(c => ({
            id: c.id,
            name: `${c.is_private ? '🔒' : '#'}${c.name}`,
            members: c.num_members,
          })),
        }
      },
    },
    {
      slug: 'get_channel_history',
      name: 'Get Channel History',
      description:
        'Retrieve recent messages from a Slack channel. channel must be a channel ID. ' +
        'Returns message text, author user ID, and timestamps. limit defaults to 20.',
      risk: 'read',
      inputSchema: {
        type: 'object',
        required: ['channel'],
        properties: {
          channel: { type: 'string', description: 'Channel ID (e.g. C01234ABCDE)' },
          limit: { type: 'number', description: 'Max messages to return (default 20, max 100)' },
          oldest: { type: 'string', description: 'Only return messages after this Unix timestamp (optional)' },
        },
      },
      execute: async (creds, params) => {
        const limit = Math.min((params.limit as number | undefined) ?? 20, 100)
        const qs: string[] = [`channel=${params.channel}`, `limit=${limit}`]
        if (params.oldest) qs.push(`oldest=${params.oldest}`)
        return slackGet(creds.api_key, `/conversations.history?${qs.join('&')}`)
      },
    },
    {
      slug: 'list_users',
      name: 'List Users',
      description:
        'List all users in the Slack workspace. Returns user ID, display name, real name, and email. ' +
        'Useful for finding user IDs for @mentions or DMs. Bots and deleted users are excluded.',
      risk: 'read',
      inputSchema: {
        type: 'object',
        properties: {
          limit: { type: 'number', description: 'Max users (default 50, max 200)' },
        },
      },
      execute: async (creds, params) => {
        const limit = Math.min((params.limit as number | undefined) ?? 50, 200)
        const res = await slackGet(creds.api_key, `/users.list?limit=${limit}`)
        if (!res.ok) return res
        type SlackUser = { id: string; name: string; real_name: string; profile: { email: string; status_text: string }; is_bot: boolean; deleted: boolean }
        const members = ((res.data as { members: SlackUser[] }).members ?? [])
        return {
          ok: true,
          data: members.filter(u => !u.is_bot && !u.deleted).map(u => ({
            id: u.id,
            name: u.real_name || u.name,
            email: u.profile?.email,
            status: u.profile?.status_text,
          })),
        }
      },
    },
    {
      slug: 'post_rich_message',
      name: 'Post Rich Message',
      description:
        'Post a Block Kit message with a bold header, body text, optional context line, and optional button link. ' +
        'Ideal for formatted notifications. button_label and button_url must be provided together.',
      risk: 'write',
      inputSchema: {
        type: 'object',
        required: ['channel', 'header', 'body'],
        properties: {
          channel: { type: 'string', description: 'Channel ID or #channel-name' },
          header: { type: 'string', description: 'Bold header text' },
          body: { type: 'string', description: 'Body text (mrkdwn: *bold*, _italic_, `code`)' },
          context: { type: 'string', description: 'Small context/footer text shown below body (optional)' },
          button_label: { type: 'string', description: 'Button label text (requires button_url)' },
          button_url: { type: 'string', description: 'Button link URL (requires button_label)' },
        },
      },
      execute: async (creds, params) => {
        const blocks: unknown[] = [
          { type: 'header', text: { type: 'plain_text', text: params.header as string, emoji: true } },
          { type: 'section', text: { type: 'mrkdwn', text: params.body as string } },
        ]
        if (params.context) {
          blocks.push({ type: 'context', elements: [{ type: 'mrkdwn', text: params.context as string }] })
        }
        if (params.button_label && params.button_url) {
          blocks.push({
            type: 'actions',
            elements: [{
              type: 'button',
              text: { type: 'plain_text', text: params.button_label as string },
              url: params.button_url as string,
            }],
          })
        }
        return slackPost(creds.api_key, '/chat.postMessage', {
          channel: params.channel,
          blocks,
          text: params.header as string,
        })
      },
    },
    {
      slug: 'add_reaction',
      name: 'Add Reaction',
      description:
        'Add an emoji reaction to a Slack message. ' +
        'Requires the channel ID, message timestamp (ts from message), and emoji name without colons ' +
        '(e.g. "white_check_mark", "thumbsup", "eyes").',
      risk: 'write',
      inputSchema: {
        type: 'object',
        required: ['channel', 'timestamp', 'emoji'],
        properties: {
          channel: { type: 'string', description: 'Channel ID where the message is' },
          timestamp: { type: 'string', description: 'Message ts field (e.g. 1512085950.000216)' },
          emoji: { type: 'string', description: 'Emoji name without colons (e.g. white_check_mark, thumbsup)' },
        },
      },
      execute: async (creds, params) => {
        return slackPost(creds.api_key, '/reactions.add', {
          channel: params.channel,
          timestamp: params.timestamp,
          name: params.emoji,
        })
      },
    },
    {
      slug: 'create_channel',
      name: 'Create Channel',
      description:
        'Create a new public or private Slack channel. ' +
        'name must be lowercase, no spaces (use hyphens, e.g. "incident-2024-06"). is_private defaults to false.',
      risk: 'write',
      inputSchema: {
        type: 'object',
        required: ['name'],
        properties: {
          name: { type: 'string', description: 'Channel name (lowercase, hyphens only, e.g. incident-jun-2024)' },
          is_private: { type: 'boolean', description: 'Create as private channel (default: false)' },
        },
      },
      execute: async (creds, params) => {
        return slackPost(creds.api_key, '/conversations.create', {
          name: params.name,
          is_private: params.is_private ?? false,
        })
      },
    },
    {
      slug: 'archive_channel',
      name: 'Archive Channel',
      description:
        'Archive a Slack channel, making it read-only and removing it from the channel list. ' +
        'Provide the channel ID. This cannot be undone easily — use with caution.',
      risk: 'destructive',
      inputSchema: {
        type: 'object',
        required: ['channel'],
        properties: {
          channel: { type: 'string', description: 'Channel ID to archive (e.g. C01234ABCDE)' },
        },
      },
      execute: async (creds, params) => {
        return slackPost(creds.api_key, '/conversations.archive', { channel: params.channel })
      },
    },
    {
      slug: 'invite_to_channel',
      name: 'Invite to Channel',
      description: 'Invite one or more users to a Slack channel. Provide the channel ID and comma-separated user IDs.',
      risk: 'write',
      inputSchema: {
        type: 'object',
        required: ['channel', 'users'],
        properties: {
          channel: { type: 'string', description: 'Channel ID to invite users to' },
          users: { type: 'string', description: 'Comma-separated user IDs (e.g. U01234,U56789)' },
        },
      },
      execute: async (creds, params) => {
        return slackPost(creds.api_key, '/conversations.invite', {
          channel: params.channel,
          users: params.users,
        })
      },
    },
    {
      slug: 'set_channel_topic',
      name: 'Set Channel Topic',
      description: 'Set or update the topic of a Slack channel. Provide the channel ID and new topic text.',
      risk: 'write',
      inputSchema: {
        type: 'object',
        required: ['channel', 'topic'],
        properties: {
          channel: { type: 'string', description: 'Channel ID' },
          topic: { type: 'string', description: 'New channel topic text' },
        },
      },
      execute: async (creds, params) => {
        return slackPost(creds.api_key, '/conversations.setTopic', {
          channel: params.channel,
          topic: params.topic,
        })
      },
    },
    {
      slug: 'search_messages',
      name: 'Search Messages',
      description:
        'Search Slack messages across all accessible channels. ' +
        'Examples: "incident in:#ops", "from:@john deployment error", "has:link after:2024-01-01".',
      risk: 'read',
      inputSchema: {
        type: 'object',
        required: ['query'],
        properties: {
          query: { type: 'string', description: 'Slack search query string' },
          limit: { type: 'number', description: 'Max results (default 20, max 100)' },
        },
      },
      execute: async (creds, params) => {
        const limit = Math.min((params.limit as number | undefined) ?? 20, 100)
        return slackGet(creds.api_key, `/search.messages?query=${encodeURIComponent(params.query as string)}&count=${limit}`)
      },
    },
    {
      slug: 'schedule_message',
      name: 'Schedule Message',
      description:
        'Schedule a message to be posted at a future time. ' +
        'post_at must be a Unix timestamp in seconds (e.g. 1735689600 for Jan 1 2025 00:00 UTC).',
      risk: 'write',
      inputSchema: {
        type: 'object',
        required: ['channel', 'text', 'post_at'],
        properties: {
          channel: { type: 'string', description: 'Channel ID or #channel-name' },
          text: { type: 'string', description: 'Message text to schedule' },
          post_at: { type: 'number', description: 'Unix timestamp (seconds) when to send' },
        },
      },
      execute: async (creds, params) => {
        return slackPost(creds.api_key, '/chat.scheduleMessage', {
          channel: params.channel,
          text: params.text,
          post_at: params.post_at,
        })
      },
    },
    {
      slug: 'delete_message',
      name: 'Delete Message',
      description:
        'Delete a Slack message by channel and timestamp (ts). ' +
        'The bot must have sent the message, or have admin/channels:manage scope to delete others\' messages.',
      risk: 'destructive',
      inputSchema: {
        type: 'object',
        required: ['channel', 'timestamp'],
        properties: {
          channel: { type: 'string', description: 'Channel ID where the message is' },
          timestamp: { type: 'string', description: 'Message ts field (e.g. 1512085950.000216)' },
        },
      },
      execute: async (creds, params) => {
        return slackPost(creds.api_key, '/chat.delete', {
          channel: params.channel,
          ts: params.timestamp,
        })
      },
    },
    {
      slug: 'update_message',
      name: 'Update Message',
      description:
        'Edit the text of an existing Slack message. The bot must be the original author of the message.',
      risk: 'write',
      inputSchema: {
        type: 'object',
        required: ['channel', 'timestamp', 'text'],
        properties: {
          channel: { type: 'string', description: 'Channel ID' },
          timestamp: { type: 'string', description: 'Message ts field' },
          text: { type: 'string', description: 'New message text' },
        },
      },
      execute: async (creds, params) => {
        return slackPost(creds.api_key, '/chat.update', {
          channel: params.channel,
          ts: params.timestamp,
          text: params.text,
        })
      },
    },
    {
      slug: 'list_pins',
      name: 'List Pinned Items',
      description: 'List messages and files pinned in a Slack channel. Returns the pinned content and who pinned it.',
      risk: 'read',
      inputSchema: {
        type: 'object',
        required: ['channel'],
        properties: {
          channel: { type: 'string', description: 'Channel ID to list pins for' },
        },
      },
      execute: async (creds, params) => {
        return slackGet(creds.api_key, `/pins.list?channel=${params.channel as string}`)
      },
    },
    {
      slug: 'open_dm',
      name: 'Open Direct Message',
      description:
        'Open or retrieve a direct message channel with a specific user. ' +
        'Returns the DM channel ID which can be used with send_message to send a private message.',
      risk: 'write',
      inputSchema: {
        type: 'object',
        required: ['user_id'],
        properties: {
          user_id: { type: 'string', description: 'Slack user ID to open DM with (e.g. U01234ABCDE)' },
        },
      },
      execute: async (creds, params) => {
        return slackPost(creds.api_key, '/conversations.open', { users: params.user_id })
      },
    },
    {
      slug: 'kick_from_channel',
      name: 'Remove User from Channel',
      description: 'Remove a user from a Slack channel. Requires channels:manage scope.',
      risk: 'write',
      inputSchema: {
        type: 'object',
        required: ['channel', 'user'],
        properties: {
          channel: { type: 'string', description: 'Channel ID' },
          user: { type: 'string', description: 'User ID to remove' },
        },
      },
      execute: async (creds, params) => {
        return slackPost(creds.api_key, '/conversations.kick', {
          channel: params.channel,
          user: params.user,
        })
      },
    },
    {
      slug: 'set_channel_purpose',
      name: 'Set Channel Purpose',
      description: 'Set or update the purpose/description of a Slack channel.',
      risk: 'write',
      inputSchema: {
        type: 'object',
        required: ['channel', 'purpose'],
        properties: {
          channel: { type: 'string', description: 'Channel ID' },
          purpose: { type: 'string', description: 'New channel purpose text' },
        },
      },
      execute: async (creds, params) => {
        return slackPost(creds.api_key, '/conversations.setPurpose', {
          channel: params.channel,
          purpose: params.purpose,
        })
      },
    },
    {
      slug: 'post_table_message',
      name: 'Post Table Message',
      description:
        'Post a message with a data table formatted as Slack mrkdwn. ' +
        'headers is a comma-separated list of column headers, ' +
        'rows is a JSON array of arrays (each inner array is one row).',
      risk: 'write',
      inputSchema: {
        type: 'object',
        required: ['channel', 'title', 'headers', 'rows'],
        properties: {
          channel: { type: 'string', description: 'Channel ID or #channel-name' },
          title: { type: 'string', description: 'Table title' },
          headers: { type: 'string', description: 'Comma-separated column headers (e.g. "Name,Status,Priority")' },
          rows: { type: 'string', description: 'JSON array of row arrays (e.g. [["INC001","Open","High"]]' },
        },
      },
      execute: async (creds, params) => {
        const headers = (params.headers as string).split(',').map(h => `*${h.trim()}*`)
        let rows: string[][] = []
        try { rows = JSON.parse(params.rows as string) } catch { rows = [] }
        const table = [
          headers.join(' | '),
          headers.map(() => '---').join(' | '),
          ...rows.map(row => row.map(c => String(c)).join(' | ')),
        ].join('\n')
        return slackPost(creds.api_key, '/chat.postMessage', {
          channel: params.channel,
          blocks: [
            { type: 'header', text: { type: 'plain_text', text: params.title as string } },
            { type: 'section', text: { type: 'mrkdwn', text: `\`\`\`${table}\`\`\`` } },
          ],
          text: params.title as string,
        })
      },
    },
  ],
}
