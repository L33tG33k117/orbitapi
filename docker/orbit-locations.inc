# Shared location blocks, included by both the HTTP and HTTPS servers so the
# two can never drift apart.

# Uploads and AI request bodies are small; connector responses are not.
client_max_body_size 25m;

# ---- Supabase-compatible API surface ----------------------------------------
# supabase-js appends /rest/v1 and /auth/v1 to its base URL, so these paths are
# fixed by the client library, not chosen by us.

location /rest/v1/ {
  proxy_pass http://orbit_rest/;
  proxy_read_timeout 60s;
}

location /auth/v1/ {
  proxy_pass http://orbit_auth/;
  proxy_read_timeout 60s;
}

# ---- the app ----------------------------------------------------------------
location / {
  proxy_pass http://orbit_app;

  # 13 routes declare maxDuration up to 300s — a playbook or a skill driving a
  # slow local model can legitimately run for minutes. nginx's 60s default
  # would cut those off at the gateway and surface as an unexplained 504.
  proxy_read_timeout 320s;
  proxy_send_timeout 320s;

  # Streaming chat must arrive token by token, not in buffered chunks.
  proxy_buffering off;
  proxy_cache off;
}

# Health is proxied to the app so a check against the gateway proves the whole
# chain, not just that nginx is up.
location = /api/health {
  proxy_pass http://orbit_app;
  access_log off;
}
