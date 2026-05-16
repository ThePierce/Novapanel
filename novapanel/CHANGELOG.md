# Changelog

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
