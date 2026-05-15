FROM node:22 AS builder
WORKDIR /app

# Cache-buster: dwingt Docker om vanaf hier altijd alles opnieuw te doen.
# Bij elke rebuild verandert de BUILD_ID dankzij --build-arg, zelfs als de
# COPY-content identiek lijkt aan een gecachete layer.
ARG BUILD_VERSION=unknown
ARG BUILD_ARCH=unknown
ARG BUILD_DATE=
ENV BUILD_ID="${BUILD_VERSION}-${BUILD_ARCH}-${BUILD_DATE}"
RUN echo "Building Novapanel ${BUILD_ID} at $(date -u +%Y-%m-%dT%H:%M:%SZ)" > /tmp/build-marker.txt

COPY . .

# Verwijder eventuele oude build-output uit de COPY (zou er niet moeten zitten,
# maar zorgt dat we altijd vanaf nul bouwen).
RUN rm -rf /app/build /app/.svelte-kit/build /app/node_modules

RUN set -eux; \
    for attempt in 1 2 3; do \
      npm install --legacy-peer-deps --fetch-retries=5 --fetch-retry-mintimeout=20000 --fetch-retry-maxtimeout=120000 && break; \
      echo "npm install failed (attempt ${attempt}/3), retrying..."; \
      sleep $((attempt * 5)); \
    done; \
    npx svelte-kit sync; \
    npm run build; \
    echo "=== CHECKING BUILD OUTPUT ==="; \
    test -d /app/build; \
    ls -la /app/build/; \
    test -f /app/build/handler.js; \
    echo "=== build verified ==="; \
    npm prune --omit=dev --legacy-peer-deps

FROM node:22-alpine
WORKDIR /app
RUN apk add --no-cache netcat-openbsd
COPY --from=builder /app/build ./build
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/server.js .
COPY --from=builder /app/package.json .
COPY --from=builder /app/data /app/data_default
COPY --from=builder /tmp/build-marker.txt /app/build-marker.txt
COPY run.sh /run.sh

# VERIFIEER dat handler.js is gekopieerd
RUN echo "=== VERIFYING FINAL IMAGE ===" && \
    ls -la /app/build/ && \
    test -f /app/build/handler.js || (echo "FATAL: handler.js not found"; exit 1); \
    cat /app/build-marker.txt

ENV PORT=8099 \
    NODE_ENV=production \
    ADDON=true
EXPOSE 8099
ENTRYPOINT []
CMD ["/bin/sh", "/run.sh"]
