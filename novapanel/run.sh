#!/bin/sh

echo "=== Nova Panel Add-on Starting ==="

INGRESS_URL=$(wget -qO- \
  --header="Authorization: Bearer ${SUPERVISOR_TOKEN}" \
  "http://supervisor/addons/self/info" | \
  node -e "
    process.stdin.setEncoding('utf8');
    let d='';
    process.stdin.on('data', c => d += c);
    process.stdin.on('end', () => {
      try {
        const u = JSON.parse(d).data.ingress_url;
        process.stdout.write(u.endsWith('/') ? u.slice(0,-1) : u);
      } catch(e) { process.stdout.write(''); }
    });
  ")

echo "Ingress URL: ${INGRESS_URL}"

export BASE_PATH="${INGRESS_URL}"
export PORT=8099
export NODE_ENV=production

# The server automatically uses Home Assistant's internal Supervisor route when
# Nova Panel runs as an add-on. HASS_URL remains available for standalone/dev use.

mkdir -p /data

echo "Starting Node.js server..."
exec node /app/server.js
