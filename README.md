# Nova Panel

Nova Panel is a Home Assistant kiosk dashboard built with Svelte 5 and SvelteKit. A fresh install starts empty on purpose: every user creates their own sections, cards, entities, and layout.

## Repository Layout

This repository is structured as a Home Assistant add-on repository:

```text
repository.yaml
novapanel/
  config.yaml
  Dockerfile
  run.sh
  package.json
  src/
  static/
```

## Requirements

Required:

- Home Assistant OS or Home Assistant Supervised with the Add-on Store.
- Home Assistant Supervisor, because Nova Panel runs as an add-on.
- Network access during add-on installation so Home Assistant can clone this repository and Docker can download the base image and npm packages.

Optional Home Assistant integrations:

- Home Assistant entities for the cards you want to use, such as `light`, `switch`, `climate`, `cover`, `vacuum`, `media_player`, `camera`, `calendar`, `person`, `zone`, and sensors.
- CalDAV or another calendar integration if you want to use the week calendar card.
- Person and zone entities if you want calendar avatars and location popups.
- Advanced Camera Card if you enable the Advanced Camera Card option for camera tiles.
- Spotify developer credentials if you want Spotify controls in the media card.

Local development only:

- Node.js 22 or newer.
- npm.
- A Home Assistant long-lived access token when running outside Home Assistant ingress.
- Docker, only if you want to test the add-on container locally.

## Install As A Home Assistant Add-on

1. In Home Assistant, go to **Settings → Add-ons → Add-on Store**.
2. Open the three-dot menu and choose **Repositories**.
3. Add this repository:

   ```text
   https://github.com/ThePierce/Novapanel
   ```

4. Install the **Nova Panel** add-on.
5. Start the add-on and open Nova Panel from the Home Assistant sidebar.
6. Open edit mode and add cards to the main area or sidebar.

Nova Panel uses the Home Assistant API through ingress when it runs as an add-on.

## Local Development

1. Install dependencies:

   ```bash
   cd novapanel
   npm install --legacy-peer-deps
   ```

2. Create a local environment file:

   ```bash
   cp .env.example .env
   ```

3. Add your Home Assistant URL and a long-lived access token:

   ```env
   HASS_URL=http://homeassistant.local:8123
   HASS_TOKEN=replace-with-token
   ```

4. Start the standalone development server:

   ```bash
   npm run dev:standalone
   ```

5. Open Nova Panel:

   ```text
   http://localhost:8099
   ```

Use `HOST=0.0.0.0` if other devices on your network should be able to open Nova Panel. Use `HOST=127.0.0.1` when testing on your own machine only.

## Dashboard Model

- Sidebar cards are intended for status views such as weather, alarm, media, availability, and device summaries.
- Main sections are intended for controls such as lights, climate, covers, vacuum, media players, cameras, and calendar cards.
- All personal dashboard state is stored locally or in the add-on state file. The repository does not include a preconfigured personal dashboard.

## Privacy

Do not commit `.env`, `.data`, exports, tokens, Home Assistant entity names, or personal images. The included static images are neutral placeholders.

## Build

The production add-on runs with `NODE_ENV=production`. Express serves the SvelteKit build from `build/handler.js`.
