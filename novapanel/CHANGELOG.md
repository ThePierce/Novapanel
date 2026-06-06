# Changelog

## 1.1.0

- Bumped the add-on, npm package, Git tag, and release version to `1.1.0`.
- Hardened multi-device sync with serialized panel-state writes, server-side timestamps, safer configuration persistence, and more reliable ingress API discovery.
- Improved the media hub: Spotify/Onkyo playback now uses the shared Nova API route discovery, TuneIn resolving is safer, and Spotify polling/auth behavior is less noisy.
- Reworked energy cost handling with explicit fixed peak/off-peak, variable estimate, and exact sensor modes, including separate import/export tariffs.
- Expanded accessibility, locale, and i18n coverage across modals, weather, energy, alarm, and calendar UI.
- Strengthened the toolchain with Prettier checks, stricter linting, Docker image validation in CI, server route tests, and broader regression coverage.
- Refactored shared helpers for persistence, fetch timeouts, server routes, card metadata, rendering safety, and edit-mode behavior.

## 1.0.6

- Protected locally saved dashboards: empty or untimestamped add-on state can no longer overwrite newer local sections and cards, and the popup size is preserved across saves, exports, and column changes.
- Failed Home Assistant service calls now roll back the optimistic UI immediately instead of waiting for the next poll, without overwriting fresh real state.
- Hardened the add-on server: panel-state CORS is limited to an allow-list of trusted origins, and TuneIn stream resolving only follows public, allow-listed hosts (SSRF protection).
- Made data loading more resilient: area/registry loading retries with backoff, and the weather forecast refreshes periodically and retries on failure instead of fetching only once.
- Fixed the alarm card to show unavailable/unknown states neutrally instead of as armed, and to honor the configured icon.
- Fixed several edit-mode and card issues: dismissing the light-group picker no longer auto-saves, dropping a card onto itself is a no-op, forecast day/night icons follow the forecast day, docked vacuums are no longer shown as active, and the Spotify settings no longer send a request on every keystroke.
- Reduced resource growth and cleaned up dead code: bounded the MDI icon cache, added TTL cleanup for pending Spotify auth states, and removed unused props, fields, and styles.

## 1.0.5

- Bumped the add-on, npm package, documentation, and Git tag version to `1.0.5`.
- Fixed entity selection and name propagation across sidebar and main-area cards, including locks, light groups, device classes, aliases, and custom names.
- Improved card sizing and layouts for content-height cards, doors and windows, room popups, alarm controls, media players, and per-device energy usage.
- Fixed media player off controls, whole-card dragging, camera title/audio behavior, and the clock second hand.
- Improved energy cost handling, tariff options, usage charts, and anchor point alignment between editor and popup views.
- Added theme support, a brighter Apple Home-inspired daylight theme, test entities for development, icon presets with manual icon entry, and more modern status icons.
- Expanded robot vacuum detail views with better map/image detection.

## 1.0.4

- Bumped the add-on, npm package, documentation, Git tag, and GitHub Release version to `1.0.4`.
- Made Home Assistant button actions feel instant by applying optimistic UI updates before the service call finishes.
- Added a short-lived optimistic state lock so fast polls with stale Home Assistant data do not immediately undo the visual feedback.
- Prefer the Nova Panel/Home Assistant service proxy before falling back to embedded Home Assistant frontend objects, reducing ingress-side click latency.

## 1.0.3

- Added a main-area Device Button Card for switch, plug, and appliance-style entities.
- Moved entity name and icon overrides into edit mode for status cards, with original Home Assistant names shown in parentheses and editor rows limited to the entities included in each card.
- Improved main-area entity button cards with faster live state refresh, percentage-only cover subtitles, and status-aware cover icons for curtains, blinds, and shutters.
- Improved camera, calendar, media image, Spotify callback, and Home Assistant proxy handling to reduce stale assets, console noise, and unnecessary browser-side subscriptions.
- Refined Home Assistant sidebar behavior inside ingress so the sidebar opens directly and hides cleanly again.

## 1.0.2

- Collapsed the section editor's Header waarden controls by default to keep large entity lists out of the way until needed.

## 1.0.1

- Removed the Home Assistant URL add-on option. Nova Panel now uses the internal Supervisor route automatically.
- Fixed browser-facing Home Assistant media URLs so camera and person images do not point at the internal `supervisor` hostname.
- Improved stale frontend chunk recovery after add-on updates.

## 1.0.0

- First public add-on release.
- Empty default dashboard with onboarding documentation.
- Home Assistant add-on repository layout.
