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

# Resolve hass_url from add-on options (if present) so each user can configure
# their own endpoint in the Home Assistant add-on configuration tab.
OPTION_HASS_URL="$(node -e "
const fs = require('fs');
try {
  const p = '/data/options.json';
  if (!fs.existsSync(p)) { process.stdout.write(''); process.exit(0); }
  const raw = fs.readFileSync(p, 'utf8');
  const obj = JSON.parse(raw || '{}');
  process.stdout.write(String(obj.hass_url || ''));
} catch {
  process.stdout.write('');
}
")"

# Keep externally provided env values when set (e.g. docker-compose),
# otherwise derive from add-on options.
if [ -z "${HASS_URL}" ] && [ -n "${OPTION_HASS_URL}" ]; then
  export HASS_URL="${OPTION_HASS_URL}"
fi
if [ -z "${ORIGIN}" ] && [ -n "${OPTION_HASS_URL}" ]; then
  export ORIGIN="${OPTION_HASS_URL}"
fi

mkdir -p /data

echo "Starting Node.js server..."
exec node /app/server.js
