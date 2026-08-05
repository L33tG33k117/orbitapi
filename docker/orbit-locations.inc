# Shared location blocks, included by the HTTP server and (when certificates
# exist) the HTTPS one, so the two can never drift apart.

# Uploads and AI request bodies are small; connector responses are not.
client_max_body_size 25m;

# Upstreams are held in VARIABLES rather than named upstream blocks. That
# forces nginx to resolve them per request through Docker's DNS instead of
# once at startup — so a backend that is still booting, or that restarts
# later, doesn't take the gateway down with "host not found in upstream".
set $orbit_app  "orbit-app:3000";
set $orbit_rest "orbit-rest:3000";
set $orbit_auth "orbit-auth:9999";

# ---- Supabase-compatible API surface ----------------------------------------
# supabase-js appends /rest/v1 and /auth/v1 to its base URL, so these paths are
# fixed by the client library, not chosen by us. The captured suffix is passed
# on so the sidecars see the paths they expect.

location ~ ^/rest/v1/(.*)$ {
  proxy_pass http://$orbit_rest/$1$is_args$args;
  proxy_read_timeout 60s;
}

location ~ ^/auth/v1/(.*)$ {
  proxy_pass http://$orbit_auth/$1$is_args$args;
  proxy_read_timeout 60s;
}

# ---- the app ----------------------------------------------------------------
location / {
  proxy_pass http://$orbit_app;

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
  proxy_pass http://$orbit_app;
  access_log off;
}
