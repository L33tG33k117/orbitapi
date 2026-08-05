import { defineRestConnector, apiKeyAuth } from '../factory'

// Cloud & Infrastructure + Data & Analytics connectors.

const AWS_SIGNING_HINT =
  'Note: real AWS calls need request signing that OrbitAPI doesn\'t support yet — ' +
  'use Simulate mode to explore this connector with realistic data.'

export const datadogManifest = defineRestConnector({
  slug: 'datadog',
  name: 'Datadog',
  category: 'Cloud & Infrastructure',
  description: 'Monitors, metrics, events, and dashboards via the Datadog API.',
  baseUrl: c => `https://api.${c.site || 'datadoghq.com'}`,
  headers: c => ({ 'DD-API-KEY': c.api_key, 'DD-APPLICATION-KEY': c.app_key }),
  auth: {
    ...apiKeyAuth({ service: 'Datadog', where: 'Organization Settings → API Keys + Application Keys' }),
    fields: [
      { key: 'api_key', label: 'API key', placeholder: 'Your Datadog API key' },
      { key: 'app_key', label: 'Application key', placeholder: 'Your application key' },
      { key: 'site', label: 'Site (optional)', placeholder: 'datadoghq.com | datadoghq.eu | us5.datadoghq.com', inputType: 'text' },
    ],
  },
  testPath: '/api/v1/validate',
  testLabel: 'Datadog account connected',
  network: { hostPattern: 'api.<your-datadog-site>' },
  actions: [
    { slug: 'list_monitors', name: 'List monitors', risk: 'read', path: '/api/v1/monitor', staticQuery: { page_size: '30' },
      description: 'Monitors with current state (OK / Alert / Warn / No Data).', params: {} },
    { slug: 'mute_monitor', name: 'Mute monitor', risk: 'write', method: 'POST', path: '/api/v1/monitor/{monitor_id}/mute',
      description: 'Silences a monitor\'s notifications.',
      params: { monitor_id: { type: 'integer', description: 'Monitor ID', required: true } } },
    { slug: 'unmute_monitor', name: 'Unmute monitor', risk: 'write', method: 'POST', path: '/api/v1/monitor/{monitor_id}/unmute',
      description: 'Re-enables a muted monitor.',
      params: { monitor_id: { type: 'integer', description: 'Monitor ID', required: true } } },
    { slug: 'query_metrics', name: 'Query metrics', risk: 'read', path: '/api/v1/query',
      description: 'Timeseries query, e.g. "avg:system.cpu.user{*}". from/to: unix seconds (defaults: last hour).',
      params: { query: { description: 'Metric query', required: true }, from: { type: 'integer', description: 'Unix start (optional)' }, to: { type: 'integer', description: 'Unix end (optional)' } } },
    { slug: 'list_events', name: 'List events', risk: 'read', path: '/api/v1/events',
      description: 'Event stream. start/end: unix seconds.',
      params: { start: { type: 'integer', description: 'Unix start', required: true }, end: { type: 'integer', description: 'Unix end', required: true } } },
    { slug: 'list_dashboards', name: 'List dashboards', risk: 'read', path: '/api/v1/dashboard',
      description: 'Dashboards with URLs.', params: {} },
    { slug: 'list_incidents', name: 'List incidents', risk: 'read', path: '/api/v2/incidents', staticQuery: { 'page[size]': '25' },
      description: 'Datadog Incident Management incidents.', params: {} },
  ],
})

export const newRelicManifest = defineRestConnector({
  slug: 'new-relic',
  name: 'New Relic',
  category: 'Cloud & Infrastructure',
  description: 'NRQL queries and entity search via the New Relic NerdGraph API.',
  baseUrl: 'https://api.newrelic.com',
  headers: c => ({ 'API-Key': c.api_key }),
  auth: {
    ...apiKeyAuth({ service: 'New Relic', keyLabel: 'User API key', keyPlaceholder: 'NRAK-…', where: 'Administration → API keys' }),
    fields: [
      { key: 'api_key', label: 'User API key', placeholder: 'NRAK-…' },
      { key: 'account_id', label: 'Account ID', placeholder: 'e.g. 1234567', inputType: 'text' },
    ],
  },
  testPath: '/graphql',
  testInit: { method: 'POST', body: { query: '{ actor { user { name } } }' } },
  testLabel: 'New Relic account connected',
  actions: [
    { slug: 'run_nrql', name: 'Run NRQL query', risk: 'read', method: 'POST', path: '/graphql',
      description: 'Runs NRQL, e.g. "SELECT average(duration) FROM Transaction SINCE 1 hour ago". Requires the account_id from your credentials.',
      wrapBody: b => ({ query: `{ actor { account(id: ${Number(b.account_id)}) { nrql(query: ${JSON.stringify(String(b.nrql))}) { results } } } }` }),
      params: { account_id: { type: 'integer', description: 'New Relic account ID', required: true }, nrql: { description: 'NRQL query', required: true } } },
    { slug: 'search_entities', name: 'Search entities', risk: 'read', method: 'POST', path: '/graphql',
      description: 'Finds monitored apps/hosts/services by name.',
      wrapBody: b => ({ query: `{ actor { entitySearch(query: ${JSON.stringify(`name LIKE '%${String(b.name).replace(/'/g, '')}%'`)}) { results { entities { name entityType domain } } } } }` }),
      params: { name: { description: 'Entity name to search', required: true } } },
    { slug: 'list_open_issues', name: 'List open issues', risk: 'read', method: 'POST', path: '/graphql',
      description: 'Open AIOps issues (alert incidents) on the account.',
      wrapBody: b => ({ query: `{ actor { account(id: ${Number(b.account_id)}) { aiIssues { issues(filter: { states: ACTIVATED }) { issues { issueId title priority } } } } } }` }),
      params: { account_id: { type: 'integer', description: 'Account ID', required: true } } },
  ],
})

export const grafanaManifest = defineRestConnector({
  slug: 'grafana',
  name: 'Grafana',
  category: 'Cloud & Infrastructure',
  description: 'Dashboards, alert rules, and annotations via the Grafana HTTP API.',
  baseUrl: c => c.host,
  headers: c => ({ Authorization: `Bearer ${c.token}` }),
  auth: {
    ...apiKeyAuth({ service: 'Grafana', where: 'Administration → Service accounts → tokens' }),
    fields: [
      { key: 'host', label: 'Grafana URL', placeholder: 'https://yourorg.grafana.net', inputType: 'text' },
      { key: 'token', label: 'Service account token', placeholder: 'glsa_…' },
    ],
  },
  testPath: '/api/health',
  testLabel: 'Grafana instance connected',
  network: { customerHost: true },
  actions: [
    { slug: 'list_dashboards', name: 'List dashboards', risk: 'read', path: '/api/search', staticQuery: { type: 'dash-db', limit: '30' },
      description: 'Dashboards. query: title filter (optional).',
      params: { query: { description: 'Title search (optional)' } } },
    { slug: 'list_alert_rules', name: 'List alert rules', risk: 'read', path: '/api/v1/provisioning/alert-rules',
      description: 'Provisioned alert rules.', params: {} },
    { slug: 'list_datasources', name: 'List data sources', risk: 'read', path: '/api/datasources',
      description: 'Configured data sources.', params: {} },
    { slug: 'list_annotations', name: 'List annotations', risk: 'read', path: '/api/annotations', staticQuery: { limit: '25' },
      description: 'Recent annotations (deploys, incidents…).', params: {} },
    { slug: 'create_annotation', name: 'Create annotation', risk: 'write', method: 'POST', path: '/api/annotations',
      description: 'Adds a global annotation (shows on time-series panels).',
      wrapBody: b => ({ text: b.text, tags: b.tags ? String(b.tags).split(',').map(t => t.trim()) : [] }),
      params: { text: { description: 'Annotation text', required: true }, tags: { description: 'Comma-separated tags (optional)' } } },
  ],
})

export const dynatraceManifest = defineRestConnector({
  slug: 'dynatrace',
  name: 'Dynatrace',
  category: 'Cloud & Infrastructure',
  description: 'Problems, entities, metrics, and events via the Dynatrace API.',
  baseUrl: c => c.environment_url,
  headers: c => ({ Authorization: `Api-Token ${c.api_token}` }),
  auth: {
    ...apiKeyAuth({ service: 'Dynatrace', where: 'Access tokens → Generate new token' }),
    fields: [
      { key: 'environment_url', label: 'Environment URL', placeholder: 'https://abc12345.live.dynatrace.com', inputType: 'text' },
      { key: 'api_token', label: 'API token', placeholder: 'dt0c01.…' },
    ],
  },
  testPath: '/api/v2/problems?pageSize=1',
  testLabel: 'Dynatrace environment connected',
  network: { customerHost: true },
  actions: [
    { slug: 'list_problems', name: 'List problems', risk: 'read', path: '/api/v2/problems', staticQuery: { pageSize: '25' },
      description: 'Detected problems with impact and status.', params: {} },
    { slug: 'get_problem', name: 'Get problem', risk: 'read', path: '/api/v2/problems/{problem_id}',
      description: 'One problem with root-cause analysis.',
      params: { problem_id: { description: 'Problem ID', required: true } } },
    { slug: 'list_hosts', name: 'List hosts', risk: 'read', path: '/api/v2/entities', staticQuery: { entitySelector: 'type("HOST")', pageSize: '25' },
      description: 'Monitored hosts.', params: {} },
    { slug: 'query_metrics', name: 'Query metrics', risk: 'read', path: '/api/v2/metrics/query',
      description: 'Metric query, e.g. metricSelector=builtin:host.cpu.usage.',
      params: { metricSelector: { description: 'Metric selector', required: true } } },
    { slug: 'list_events', name: 'List events', risk: 'read', path: '/api/v2/events', staticQuery: { pageSize: '25' },
      description: 'Recent events (deployments, anomalies…).', params: {} },
  ],
})

export const awsCloudwatchManifest = defineRestConnector({
  slug: 'aws-cloudwatch',
  name: 'AWS CloudWatch',
  category: 'Cloud & Infrastructure',
  description: 'Alarms and metrics from AWS CloudWatch.',
  baseUrl: c => `https://monitoring.${c.region || 'us-east-1'}.amazonaws.com`,
  headers: c => ({ 'Content-Type': 'application/x-amz-json-1.0', Authorization: `Bearer ${c.access_key}` }),
  auth: {
    ...apiKeyAuth({ service: 'AWS', where: 'IAM → Security credentials', keyHint: AWS_SIGNING_HINT }),
    fields: [
      { key: 'access_key', label: 'Access key ID', placeholder: 'AKIA…', inputType: 'text', hint: AWS_SIGNING_HINT },
      { key: 'secret_key', label: 'Secret access key', placeholder: 'Your secret key' },
      { key: 'region', label: 'Region', placeholder: 'us-east-1', inputType: 'text' },
    ],
  },
  testPath: '/',
  testLabel: 'CloudWatch connected',
  network: { hostPattern: 'monitoring.<your-region>.amazonaws.com' },
  actions: [
    { slug: 'describe_alarms', name: 'List alarms', risk: 'read', method: 'POST', path: '/', headers: { 'X-Amz-Target': 'GraniteServiceVersion20100801.DescribeAlarms' },
      description: 'CloudWatch alarms with state (OK / ALARM / INSUFFICIENT_DATA).',
      wrapBody: () => ({ MaxRecords: 50 }), params: {} },
    { slug: 'describe_alarm_history', name: 'Alarm history', risk: 'read', method: 'POST', path: '/', headers: { 'X-Amz-Target': 'GraniteServiceVersion20100801.DescribeAlarmHistory' },
      description: 'Recent alarm state changes.',
      wrapBody: b => ({ MaxRecords: 25, ...(b.alarm_name ? { AlarmName: b.alarm_name } : {}) }),
      params: { alarm_name: { description: 'Filter by alarm name (optional)' } } },
    { slug: 'list_metrics', name: 'List metrics', risk: 'read', method: 'POST', path: '/', headers: { 'X-Amz-Target': 'GraniteServiceVersion20100801.ListMetrics' },
      description: 'Available metrics. namespace: e.g. AWS/EC2 (optional).',
      wrapBody: b => (b.namespace ? { Namespace: b.namespace } : {}),
      params: { namespace: { description: 'Metric namespace, e.g. AWS/EC2 (optional)' } } },
    { slug: 'set_alarm_state', name: 'Set alarm state', risk: 'write', method: 'POST', path: '/', headers: { 'X-Amz-Target': 'GraniteServiceVersion20100801.SetAlarmState' },
      description: 'Manually sets an alarm state (e.g. for testing notification paths).',
      wrapBody: b => ({ AlarmName: b.alarm_name, StateValue: b.state, StateReason: b.reason ?? 'Set via OrbitAPI' }),
      params: { alarm_name: { description: 'Alarm name', required: true }, state: { description: 'OK | ALARM | INSUFFICIENT_DATA', required: true, enum: ['OK', 'ALARM', 'INSUFFICIENT_DATA'] }, reason: { description: 'Reason (optional)' } } },
  ],
})

export const awsSsmManifest = defineRestConnector({
  slug: 'aws-ssm',
  name: 'AWS Systems Manager',
  category: 'Cloud & Infrastructure',
  description: 'Managed instances, run commands, and parameters via AWS SSM.',
  baseUrl: c => `https://ssm.${c.region || 'us-east-1'}.amazonaws.com`,
  headers: c => ({ 'Content-Type': 'application/x-amz-json-1.1', Authorization: `Bearer ${c.access_key}` }),
  auth: {
    ...apiKeyAuth({ service: 'AWS', where: 'IAM → Security credentials', keyHint: AWS_SIGNING_HINT }),
    fields: [
      { key: 'access_key', label: 'Access key ID', placeholder: 'AKIA…', inputType: 'text', hint: AWS_SIGNING_HINT },
      { key: 'secret_key', label: 'Secret access key', placeholder: 'Your secret key' },
      { key: 'region', label: 'Region', placeholder: 'us-east-1', inputType: 'text' },
    ],
  },
  testPath: '/',
  testLabel: 'AWS SSM connected',
  network: { hostPattern: 'ssm.<your-region>.amazonaws.com' },
  actions: [
    { slug: 'list_instances', name: 'List managed instances', risk: 'read', method: 'POST', path: '/', headers: { 'X-Amz-Target': 'AmazonSSM.DescribeInstanceInformation' },
      description: 'SSM-managed instances with ping status and platform.',
      wrapBody: () => ({ MaxResults: 50 }), params: {} },
    { slug: 'send_command', name: 'Run shell command', risk: 'destructive', method: 'POST', path: '/', headers: { 'X-Amz-Target': 'AmazonSSM.SendCommand' },
      description: 'Runs a shell command on an instance via SSM. Confirm before using.',
      wrapBody: b => ({ InstanceIds: [b.instance_id], DocumentName: 'AWS-RunShellScript', Parameters: { commands: [b.command] } }),
      params: { instance_id: { description: 'Instance ID (i-…)', required: true }, command: { description: 'Shell command to run', required: true } } },
    { slug: 'list_commands', name: 'List command invocations', risk: 'read', method: 'POST', path: '/', headers: { 'X-Amz-Target': 'AmazonSSM.ListCommands' },
      description: 'Recent SSM commands with status.',
      wrapBody: () => ({ MaxResults: 25 }), params: {} },
    { slug: 'list_parameters', name: 'List parameters', risk: 'read', method: 'POST', path: '/', headers: { 'X-Amz-Target': 'AmazonSSM.DescribeParameters' },
      description: 'Parameter Store entries (names/types, not values).',
      wrapBody: () => ({ MaxResults: 50 }), params: {} },
  ],
})

export const azureMonitorManifest = defineRestConnector({
  slug: 'azure-monitor',
  name: 'Azure Monitor',
  category: 'Cloud & Infrastructure',
  description: 'Alerts and metric alert rules via the Azure Monitor management API.',
  baseUrl: c => `https://management.azure.com/subscriptions/${c.subscription_id}`,
  headers: c => ({ Authorization: `Bearer ${c.access_token}` }),
  auth: {
    ...apiKeyAuth({ service: 'Azure', where: 'Azure AD app registration (ARM token)' }),
    fields: [
      { key: 'access_token', label: 'ARM access token', placeholder: 'eyJ…', hint: 'Advanced — most people should use Simulate mode.' },
      { key: 'subscription_id', label: 'Subscription ID', placeholder: 'GUID', inputType: 'text' },
    ],
  },
  testPath: '/providers/Microsoft.AlertsManagement/alerts?api-version=2019-05-05&pageCount=1',
  testLabel: 'Azure subscription connected',
  network: { hosts: ['management.azure.com'] },
  actions: [
    { slug: 'list_alerts', name: 'List alerts', risk: 'read', path: '/providers/Microsoft.AlertsManagement/alerts', staticQuery: { 'api-version': '2019-05-05', pageCount: '25' },
      description: 'Fired alerts across the subscription with severity and state.', params: {} },
    { slug: 'list_metric_alert_rules', name: 'List metric alert rules', risk: 'read', path: '/providers/Microsoft.Insights/metricAlerts', staticQuery: { 'api-version': '2018-03-01' },
      description: 'Configured metric alert rules.', params: {} },
    { slug: 'list_activity_log_alerts', name: 'List activity log alert rules', risk: 'read', path: '/providers/Microsoft.Insights/activityLogAlerts', staticQuery: { 'api-version': '2020-10-01' },
      description: 'Activity-log alert rules.', params: {} },
  ],
})

export const gcpMonitoringManifest = defineRestConnector({
  slug: 'gcp-monitoring',
  name: 'Google Cloud Monitoring',
  category: 'Cloud & Infrastructure',
  description: 'Alert policies, uptime checks, and time series via the Cloud Monitoring API.',
  baseUrl: 'https://monitoring.googleapis.com/v3',
  headers: c => ({ Authorization: `Bearer ${c.access_token}` }),
  auth: {
    ...apiKeyAuth({ service: 'Google Cloud', where: 'gcloud auth print-access-token' }),
    fields: [
      { key: 'access_token', label: 'OAuth access token', placeholder: 'ya29.… (gcloud auth print-access-token)', hint: 'Advanced — most people should use Simulate mode.' },
      { key: 'project_id', label: 'Project ID', placeholder: 'my-gcp-project', inputType: 'text' },
    ],
  },
  testPath: '/projects/-/alertPolicies?pageSize=1',
  testLabel: 'GCP project connected',
  actions: [
    { slug: 'list_alert_policies', name: 'List alert policies', risk: 'read', path: '/projects/{project_id}/alertPolicies', staticQuery: { pageSize: '30' },
      description: 'Alerting policies with enabled state.',
      params: { project_id: { description: 'GCP project ID', required: true } } },
    { slug: 'list_uptime_checks', name: 'List uptime checks', risk: 'read', path: '/projects/{project_id}/uptimeCheckConfigs',
      description: 'Configured uptime checks.',
      params: { project_id: { description: 'GCP project ID', required: true } } },
    { slug: 'list_notification_channels', name: 'List notification channels', risk: 'read', path: '/projects/{project_id}/notificationChannels', staticQuery: { pageSize: '30' },
      description: 'Where alerts get sent (email, Slack, PagerDuty…).',
      params: { project_id: { description: 'GCP project ID', required: true } } },
    { slug: 'list_time_series', name: 'Query time series', risk: 'read', path: '/projects/{project_id}/timeSeries',
      description: 'Reads metric data. filter e.g. metric.type="compute.googleapis.com/instance/cpu/utilization". interval.startTime/endTime: RFC3339.',
      params: { project_id: { description: 'Project ID', required: true }, filter: { description: 'Metric filter', required: true }, 'interval.startTime': { description: 'RFC3339 start', required: true }, 'interval.endTime': { description: 'RFC3339 end', required: true } } },
  ],
})

// ── Data & Analytics ─────────────────────────────────────────────────────────

export const bigqueryManifest = defineRestConnector({
  slug: 'bigquery',
  name: 'BigQuery',
  category: 'Data & Analytics',
  description: 'Run SQL queries and browse datasets via the BigQuery API.',
  baseUrl: 'https://bigquery.googleapis.com/bigquery/v2',
  headers: c => ({ Authorization: `Bearer ${c.access_token}` }),
  auth: {
    ...apiKeyAuth({ service: 'Google Cloud', where: 'gcloud auth print-access-token' }),
    fields: [
      { key: 'access_token', label: 'OAuth access token', placeholder: 'ya29.…', hint: 'Advanced — most people should use Simulate mode.' },
      { key: 'project_id', label: 'Project ID', placeholder: 'my-gcp-project', inputType: 'text' },
    ],
  },
  testPath: '/projects?maxResults=1',
  testLabel: 'BigQuery connected',
  actions: [
    { slug: 'run_query', name: 'Run SQL query', risk: 'read', method: 'POST', path: '/projects/{project_id}/queries',
      description: 'Runs standard SQL, e.g. "SELECT name, SUM(number) FROM `bigquery-public-data.usa_names.usa_1910_2013` GROUP BY name LIMIT 10".',
      wrapBody: b => ({ query: b.query, useLegacySql: false, maxResults: 100 }),
      params: { project_id: { description: 'Billing project ID', required: true }, query: { description: 'Standard SQL query', required: true } } },
    { slug: 'list_datasets', name: 'List datasets', risk: 'read', path: '/projects/{project_id}/datasets',
      description: 'Datasets in a project.',
      params: { project_id: { description: 'Project ID', required: true } } },
    { slug: 'list_tables', name: 'List tables', risk: 'read', path: '/projects/{project_id}/datasets/{dataset_id}/tables',
      description: 'Tables in a dataset.',
      params: { project_id: { description: 'Project ID', required: true }, dataset_id: { description: 'Dataset ID', required: true } } },
  ],
})

export const snowflakeManifest = defineRestConnector({
  slug: 'snowflake',
  name: 'Snowflake',
  category: 'Data & Analytics',
  description: 'Run SQL statements via the Snowflake SQL REST API.',
  baseUrl: c => `https://${c.account_identifier}.snowflakecomputing.com`,
  headers: c => ({ Authorization: `Bearer ${c.token}`, 'X-Snowflake-Authorization-Token-Type': 'PROGRAMMATIC_ACCESS_TOKEN' }),
  auth: {
    ...apiKeyAuth({ service: 'Snowflake', where: 'Snowsight → your user → Programmatic access tokens' }),
    fields: [
      { key: 'account_identifier', label: 'Account identifier', placeholder: 'xy12345.us-east-1', inputType: 'text' },
      { key: 'token', label: 'Programmatic access token', placeholder: 'Your Snowflake PAT' },
    ],
  },
  testPath: '/api/v2/statements?pageSize=1',
  testLabel: 'Snowflake account connected',
  network: { hostPattern: '<your-account>.snowflakecomputing.com' },
  actions: [
    { slug: 'run_sql', name: 'Run SQL', risk: 'read', method: 'POST', path: '/api/v2/statements',
      description: 'Executes a SQL statement, e.g. "SELECT * FROM ORDERS LIMIT 20". warehouse: compute warehouse name.',
      wrapBody: b => ({ statement: b.statement, timeout: 60, ...(b.warehouse ? { warehouse: b.warehouse } : {}), ...(b.database ? { database: b.database } : {}) }),
      params: { statement: { description: 'SQL statement', required: true }, warehouse: { description: 'Warehouse (optional)' }, database: { description: 'Database (optional)' } } },
    { slug: 'get_statement', name: 'Get statement result', risk: 'read', path: '/api/v2/statements/{statement_handle}',
      description: 'Fetches results of an async statement.',
      params: { statement_handle: { description: 'Statement handle', required: true } } },
  ],
})

export const databricksManifest = defineRestConnector({
  slug: 'databricks',
  name: 'Databricks',
  category: 'Data & Analytics',
  description: 'Clusters, jobs, and SQL statements via the Databricks REST API.',
  baseUrl: c => c.host,
  headers: c => ({ Authorization: `Bearer ${c.token}` }),
  auth: {
    ...apiKeyAuth({ service: 'Databricks', where: 'User Settings → Developer → Access tokens' }),
    fields: [
      { key: 'host', label: 'Workspace URL', placeholder: 'https://dbc-abc123.cloud.databricks.com', inputType: 'text' },
      { key: 'token', label: 'Personal access token', placeholder: 'dapi…' },
    ],
  },
  testPath: '/api/2.0/clusters/list',
  testLabel: 'Databricks workspace connected',
  network: { customerHost: true },
  actions: [
    { slug: 'list_clusters', name: 'List clusters', risk: 'read', path: '/api/2.0/clusters/list',
      description: 'Compute clusters with state.', params: {} },
    { slug: 'list_jobs', name: 'List jobs', risk: 'read', path: '/api/2.1/jobs/list', staticQuery: { limit: '25' },
      description: 'Scheduled jobs.', params: {} },
    { slug: 'run_job', name: 'Run job now', risk: 'write', method: 'POST', path: '/api/2.1/jobs/run-now',
      description: 'Triggers a job run.',
      wrapBody: b => ({ job_id: Number(b.job_id) }),
      params: { job_id: { type: 'integer', description: 'Job ID', required: true } } },
    { slug: 'list_job_runs', name: 'List job runs', risk: 'read', path: '/api/2.1/jobs/runs/list', staticQuery: { limit: '25' },
      description: 'Recent job runs with status.', params: {} },
    { slug: 'run_sql', name: 'Run SQL statement', risk: 'read', method: 'POST', path: '/api/2.0/sql/statements',
      description: 'Executes SQL on a SQL warehouse.',
      wrapBody: b => ({ statement: b.statement, warehouse_id: b.warehouse_id, wait_timeout: '30s' }),
      params: { statement: { description: 'SQL statement', required: true }, warehouse_id: { description: 'SQL warehouse ID', required: true } } },
  ],
})

export const powerBiManifest = defineRestConnector({
  slug: 'power-bi',
  name: 'Power BI',
  category: 'Data & Analytics',
  description: 'Dashboards, reports, and dataset refreshes via the Power BI REST API.',
  baseUrl: 'https://api.powerbi.com/v1.0/myorg',
  headers: c => ({ Authorization: `Bearer ${c.access_token}` }),
  auth: apiKeyAuth({ service: 'Power BI', keyLabel: 'Azure AD access token', keyPlaceholder: 'eyJ…', where: 'Azure AD app (Power BI scope)', keyHint: 'Advanced — most people should use Simulate mode.' }),
  testPath: '/availableFeatures',
  testLabel: 'Power BI connected',
  actions: [
    { slug: 'list_workspaces', name: 'List workspaces', risk: 'read', path: '/groups',
      description: 'Power BI workspaces (groups).', params: {} },
    { slug: 'list_dashboards', name: 'List dashboards', risk: 'read', path: '/dashboards',
      description: 'Dashboards in "My workspace".', params: {} },
    { slug: 'list_reports', name: 'List reports', risk: 'read', path: '/reports',
      description: 'Reports in "My workspace".', params: {} },
    { slug: 'list_datasets', name: 'List datasets', risk: 'read', path: '/datasets',
      description: 'Datasets with refresh info.', params: {} },
    { slug: 'refresh_dataset', name: 'Refresh dataset', risk: 'write', method: 'POST', path: '/datasets/{dataset_id}/refreshes',
      description: 'Triggers a dataset refresh.',
      params: { dataset_id: { description: 'Dataset ID', required: true } } },
  ],
})

export const tableauManifest = defineRestConnector({
  slug: 'tableau',
  name: 'Tableau',
  category: 'Data & Analytics',
  description: 'Workbooks, views, and data sources via the Tableau REST API.',
  baseUrl: c => c.server_url,
  headers: c => ({ 'X-Tableau-Auth': c.token }),
  auth: {
    ...apiKeyAuth({ service: 'Tableau', where: 'My Account Settings → Personal Access Tokens (then sign in via API for a session token)' }),
    fields: [
      { key: 'server_url', label: 'Server URL', placeholder: 'https://10ax.online.tableau.com', inputType: 'text' },
      { key: 'site_id', label: 'Site ID (LUID)', placeholder: 'Site LUID from signin response', inputType: 'text' },
      { key: 'token', label: 'Session token', placeholder: 'X-Tableau-Auth token', hint: 'Advanced — most people should use Simulate mode.' },
    ],
  },
  testPath: '/api/3.22/serverinfo',
  testLabel: 'Tableau server connected',
  network: { customerHost: true },
  actions: [
    { slug: 'list_workbooks', name: 'List workbooks', risk: 'read', path: '/api/3.22/sites/{site_id}/workbooks', staticQuery: { pageSize: '30' },
      description: 'Workbooks on the site.',
      params: { site_id: { description: 'Site LUID', required: true } } },
    { slug: 'list_views', name: 'List views', risk: 'read', path: '/api/3.22/sites/{site_id}/views', staticQuery: { pageSize: '30' },
      description: 'Views (sheets/dashboards) with usage.',
      params: { site_id: { description: 'Site LUID', required: true } } },
    { slug: 'list_datasources', name: 'List data sources', risk: 'read', path: '/api/3.22/sites/{site_id}/datasources', staticQuery: { pageSize: '30' },
      description: 'Published data sources.',
      params: { site_id: { description: 'Site LUID', required: true } } },
    { slug: 'list_users', name: 'List users', risk: 'read', path: '/api/3.22/sites/{site_id}/users', staticQuery: { pageSize: '30' },
      description: 'Users on the site.',
      params: { site_id: { description: 'Site LUID', required: true } } },
  ],
})

export const cloudDataConnectors = [
  datadogManifest, newRelicManifest, grafanaManifest, dynatraceManifest,
  awsCloudwatchManifest, awsSsmManifest, azureMonitorManifest, gcpMonitoringManifest,
  bigqueryManifest, snowflakeManifest, databricksManifest, powerBiManifest, tableauManifest,
]
