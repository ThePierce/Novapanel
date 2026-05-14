# Novapanel

Novapanel is een Home Assistant kiosk-dashboard, gebouwd met Svelte 5 en SvelteKit. De eerste start is bewust leeg: iedere gebruiker kiest zelf secties, kaarten en entiteiten.

## Home Assistant add-on

1. Voeg deze repository toe als Home Assistant add-on repository:

   ```text
   https://github.com/ThePierce/Novapanel
   ```

2. Installeer de add-on **Nova Panel**.
3. Start de add-on en open Novapanel via de Home Assistant zijbalk.
4. Open edit mode en voeg kaarten toe aan het hoofdgedeelte of de sidebar.

Novapanel gebruikt de Home Assistant API via ingress. Voor lokale ontwikkeling kun je ook een long-lived access token gebruiken.

## Standalone ontwikkelen

1. Installeer dependencies:

   ```bash
   npm install --legacy-peer-deps
   ```

2. Maak een lokale config:

   ```bash
   cp .env.example .env
   ```

3. Vul in `.env` je Home Assistant URL en long-lived access token in:

   ```env
   HASS_URL=http://homeassistant.local:8123
   HASS_TOKEN=replace-with-token
   ```

4. Start de standalone dev-server:

   ```bash
   npm run dev:standalone
   ```

5. Open Novapanel:

   ```text
   http://localhost:8099
   ```

Laat `HOST=0.0.0.0` staan als andere apparaten in je netwerk Novapanel moeten kunnen openen. Gebruik `HOST=127.0.0.1` als je alleen lokaal test.

## Dashboard opzet

- Sidebar-kaarten zijn bedoeld voor statusoverzichten zoals weer, alarm, media en apparaten.
- Hoofdsecties zijn bedoeld voor bedieningskaarten zoals lampen, climate, cover, vacuum, mediaspelers, camera's en kalender.
- Alle inrichting wordt lokaal of via de add-on state opgeslagen; de repository bevat geen persoonlijke dashboardconfiguratie.

## Privacy

Commit geen `.env`, `.data`, exports, tokens of Home Assistant-entiteitsnamen. De voorbeeldafbeeldingen zijn neutrale placeholders.

## Build

De productie-add-on draait via `NODE_ENV=production`, waarbij Express de SvelteKit build uit `build/handler.js` serveert.
