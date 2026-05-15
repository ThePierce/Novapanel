# Nova Panel Add-on

Nova Panel is a Home Assistant kiosk dashboard that starts empty. Use edit mode to add sidebar cards, main sections, and Home Assistant entities.

## Installation

Install this add-on through the Home Assistant Add-on Store by adding the repository:

```text
https://github.com/ThePierce/Novapanel
```

Then install **Nova Panel**, start the add-on, and open it from the Home Assistant sidebar.

## Dependencies

Runtime requirements:

- Home Assistant OS or Home Assistant Supervised.
- Home Assistant Supervisor and Add-on Store.
- Network access during installation for Docker and npm dependency downloads.

Optional Home Assistant integrations and custom cards:

- Calendar integration, for example CalDAV, for the week calendar card.
- Person and zone entities for calendar avatars, location popups, and travel estimates.
- Music Assistant for Music Assistant speaker targets in the media hub.
- Advanced Camera Card if you enable Advanced Camera Card rendering for cameras.
- Spotify developer credentials for Spotify playback controls.
- The Home Assistant entity domains you want to control, such as `light`, `switch`, `climate`, `cover`, `vacuum`, `media_player`, `camera`, and `sensor`.

Local development requirements:

- Node.js 22 or newer.
- npm.
- A Home Assistant long-lived access token when running outside ingress.

## Local Development

```bash
npm install --legacy-peer-deps
cp .env.example .env
npm run dev:standalone
```

Fill `.env` with a Home Assistant URL and long-lived access token when developing outside Home Assistant ingress.
