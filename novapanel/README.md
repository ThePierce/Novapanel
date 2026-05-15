# Nova Panel

Nova Panel is een Home Assistant kiosk-dashboard met een lege eerste start. Open edit mode om zelf sidebar-kaarten, secties en Home Assistant-entiteiten toe te voegen.

## Installatie

Installeer deze add-on via de Home Assistant Add-on Store door de repository toe te voegen:

```text
https://github.com/ThePierce/Novapanel
```

Start daarna de add-on en open Nova Panel via de Home Assistant zijbalk.

## Lokale ontwikkeling

```bash
npm install --legacy-peer-deps
cp .env.example .env
npm run dev:standalone
```

Vul in `.env` een Home Assistant URL en long-lived access token in wanneer je buiten Home Assistant ingress ontwikkelt.
