# Design Decisions / Known Non-Issues

This file records deliberate choices that look like bugs in a review but are intentional.
Please check here before "fixing" any of the items below, and update this file when a
decision changes.

Last reviewed: 2026-06-06 (after the proxy hardening bundle).

## R4 — `card-meta.ts` is the single source of truth for card icon/accent

`src/lib/cards/card-meta.ts` provides `getCardTypeStyling`/`getCardTypeIcon`/`getCardDraftTitle`,
used by the card library, the card editor header, and the section list/editor. During the
round-3 extraction this unified four card types (`clock`, `date`, `devices_status`,
`availability_status`) whose editor header icon/accent previously differed from the library.

- Status: the unified mapping is authoritative on purpose — library, editor and section views
  must show the same icon/accent per card type. The visual change for those four types is
  intended, not drift.
- If revisited: change the values in `card-meta.ts` only (never re-introduce per-view overrides).

## L1 — EnergyCard renders only `net`

`EnergyCard.svelte` derives `solar`, `battery`, `grid`, and `batteryCharge` (with matching
props) but only renders `net`. This is intentional for now: the extra entities are reserved
for a future expanded energy view. Leaving the props in keeps stored card configs and the
editor stable.

- Status: kept on purpose (owner/design decision).
- If revisited: either build the expanded view that uses these values, or remove the unused
  `$derived` values **and** the props together (a props-only removal would break saved configs).

## L10 — Week calendar DST alignment

`WeekCalendarCard.svelte` lays out events and the "now" line against a millisecond time
window, while the hour grid has a fixed 24 rows. On DST-transition days (23h/25h) events and
the now-line can be off by up to an hour relative to the grid lines.

- Status: accepted edge case. The dead `--visible-hours` CSS variable was removed; the DST
  alignment itself was intentionally left as-is because a proper fix touches core calendar
  layout behavior for a twice-a-year edge case.
- If revisited: scale rows by the actual day length on DST days instead of a fixed 24.

## D1 — Host networking remains enabled for add-on compatibility

Nova Panel still serves its UI through Home Assistant ingress, but real add-on installs have
reported 502 failures from calendar and service proxy routes when `host_network` was removed.
The add-on therefore keeps host networking enabled to preserve the same Home Assistant and
Supervisor reachability behavior as the stable 1.0.x releases.

- Status: `host_network: true` is present in `config.yaml` as a runtime compatibility measure.
- If revisited: first validate calendar, service-call, camera, and media proxy routes in an
  installed Home Assistant add-on, not only in CI or local standalone mode.

## D3 — HA token exposure is transitional

`/api/ha/connection` can still return the configured HA token for legacy direct-browser
fallbacks used by service calls and camera details. Sensitive local JSON files are written
atomically with mode `0600`, and the add-on is kept ingress-only so this route is not exposed
directly on the LAN.

- Status: accepted temporarily for compatibility. The configured options token should be
  minimally privileged.
- If revisited: remove browser-token delivery after all HA actions and camera paths use the
  server proxy.

## D5 — Runtime drops privileges after preparing `/data`

The Docker image creates a non-root `nova` user and the add-on start script runs the Node
server through `su-exec nova` after ensuring `/data` is writable. Home Assistant provides
`/data` as a supervisor-managed volume, so the script keeps a root fallback only when that
volume cannot be chowned in a real add-on install.

- Status: least-privilege by default; root fallback is an explicit compatibility escape hatch
  for HA volume permissions.
- If revisited: remove the fallback only after validating an installed add-on can still write
  `novapanel-state.json`, `spotify-token.json`, and `energy-assets` under `/data`.

## D4 — Concurrent dashboard edits warn before last-write-wins

Panel-state writes are serialized server-side and `dashboard.updatedAt` / `configuration.updatedAt`
are stamped by the server, so concurrent POSTs no longer lose data through read-modify-write
races or client clock skew. The dashboard payload itself is still stored as a whole-dashboard
snapshot.

- Status: accepted for now. The editor stores the dashboard `updatedAt` when edit mode starts
  and warns if the server moved forward before save. If the user confirms, the newest serialized
  whole-dashboard save still wins.
- If revisited: introduce card/section-level merge semantics instead of replacing the whole
  dashboard snapshot.

## D2 — `media_players_status` icon overrides

Per-entity icon overrides for `media_players_status` cards are persisted (no longer dropped on
save), but they are not yet actively applied in the UI.

- Status: data is preserved intentionally; UI wiring is a future enhancement, not a bug.
- If revisited: apply `statusEntityIconOverrides` for the media-players status card in the
  render path.
