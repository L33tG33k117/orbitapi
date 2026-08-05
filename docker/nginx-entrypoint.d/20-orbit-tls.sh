#!/bin/sh
# Enable HTTPS only when certificates are actually present.
#
# nginx refuses to start at all if an ssl_certificate path doesn't resolve, so
# a static TLS server block would make the gateway unbootable on any install
# that hasn't generated certs yet — including a plain `docker compose up`.
# Serving HTTP and warning is far better than serving nothing.
#
# The nginx image runs everything in /docker-entrypoint.d before starting.
set -e

CERT=/etc/nginx/certs/cert.pem
KEY=/etc/nginx/certs/key.pem
OUT=/etc/nginx/conf.d/orbit-tls.conf

if [ ! -f "$CERT" ] || [ ! -f "$KEY" ]; then
  echo "[orbit-gateway] no certificates at /etc/nginx/certs — serving HTTP only."
  echo "[orbit-gateway] run ./orbit.sh install, or drop cert.pem and key.pem in docker/certs, to enable HTTPS."
  rm -f "$OUT"
  exit 0
fi

echo "[orbit-gateway] certificates found — enabling HTTPS on 443."
cat > "$OUT" <<'EOF'
server {
  listen 443 ssl;
  http2 on;
  server_name _;

  ssl_certificate     /etc/nginx/certs/cert.pem;
  ssl_certificate_key /etc/nginx/certs/key.pem;
  ssl_protocols       TLSv1.2 TLSv1.3;
  ssl_session_cache   shared:SSL:10m;

  include /etc/nginx/conf.d/orbit-locations.inc;
}
EOF
