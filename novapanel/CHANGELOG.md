# Changelog

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
