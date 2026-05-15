# Nova Panel

Nova Panel is a Home Assistant kiosk dashboard built with Svelte 5 and SvelteKit. A fresh install starts empty on purpose: every user creates their own sections, cards, entities, and layout.

## Table Of Contents

- [Install As A Home Assistant Add-on](#install-as-a-home-assistant-add-on)
- [Add-on Configuration](#add-on-configuration)
- [Optional Integrations](#optional-integrations)
- [Dashboard Model](#dashboard-model)
- [Using Edit Mode](#using-edit-mode)
- [Card Reference](#card-reference)
  - [Sidebar Cards](#sidebar-cards)
  - [Main Area Cards](#main-area-cards)

## Install As A Home Assistant Add-on

1. In Home Assistant, go to **Settings → Add-ons → Add-on Store**.
2. Open the three-dot menu and choose **Repositories**.
3. Add this repository: https://github.com/ThePierce/Novapanel
4. Install the **Nova Panel** add-on.
5. Start the add-on and open Nova Panel from the Home Assistant sidebar.
6. Open edit mode and add cards to the main area or sidebar.

Nova Panel uses the Home Assistant API through ingress when it runs as an add-on.

## Add-on Configuration

After installing Nova Panel, open the add-on **Configuration** tab in Home Assistant.

Set this option:

- `token`: paste a Home Assistant long-lived access token.

Create the token from your Home Assistant user profile:

1. Open your Home Assistant profile.
2. Scroll to **Long-Lived Access Tokens**.
3. Create a new token.
4. Paste that token into the Nova Panel add-on `token` field.
5. Save the add-on configuration and restart Nova Panel.

Nova Panel automatically talks to Home Assistant through the add-on's internal Supervisor route. You do not need to enter a Home Assistant URL in the add-on configuration.

The token is required for entity data, service calls, cameras, calendars, media controls, and other Home Assistant-backed cards. A fresh install can open without it, but most cards will not be able to load data or control devices until the token is set.

## Optional Integrations

- Home Assistant entities for the cards you want to use, such as `light`, `switch`, `climate`, `cover`, `vacuum`, `media_player`, `camera`, `calendar`, `person`, `zone`, and sensors.
- CalDAV or another calendar integration if you want to use the week calendar card.
- Person and zone entities if you want calendar avatars and location popups.
- Music Assistant if you want the media hub to play Spotify or radio streams through Music Assistant speaker targets.
- Advanced Camera Card if you enable the Advanced Camera Card option for camera tiles.
- Spotify developer credentials if you want Spotify controls in the media hub.

## Dashboard Model

- Sidebar cards are intended for status views such as weather, alarm, media, availability, and device summaries.
- Main sections are intended for controls such as lights, climate, covers, vacuum, media players, cameras, and calendar cards.
- All personal dashboard state is stored locally or in the add-on state file. The repository does not include a preconfigured personal dashboard.

## Using Edit Mode

Open edit mode from Nova Panel to add, configure, reorder, or remove cards. Cards in the sidebar are best for summaries and status panels. Cards in the main area live inside sections, and each section can be renamed, assigned an icon, configured with responsive columns, and optionally given right-aligned sensor chips such as temperature, humidity, or pressure.

Entity pickers use Home Assistant friendly names when available. If an entity has no friendly name, Nova Panel falls back to the Home Assistant entity ID so the item can still be identified.

Most cards ask for one or more Home Assistant entities. Start by selecting the entity, then optionally set a custom display name, icon, color, ignored entities, or card-specific options. Save the card when the preview looks right.

## Card Reference

The card guides below are collapsed by default. Expand the card you want to configure.

### Sidebar Cards

<details>
<summary><strong>Clock Card</strong></summary>

The clock card shows the current time in a large kiosk-friendly format.

Use it when the panel is always visible in a hallway, kitchen, office, or wall tablet. It does not need a Home Assistant entity.

What to fill in:

- Add the card to the sidebar.
- Optionally rename the card if you want a custom label in edit mode.
- No entity configuration is required.

</details>

<details>
<summary><strong>Date Card</strong></summary>

The date card shows the current day and date.

Use it next to the clock card when the panel is used as a household overview.

What to fill in:

- Add the card to the sidebar.
- No Home Assistant entity is required.
- The displayed language follows the language selected in Nova Panel settings.

</details>

<details>
<summary><strong>Divider Card</strong></summary>

The divider card creates visual spacing between sidebar groups.

Use it to separate areas such as weather, security, media, and household status.

What to fill in:

- Add the card to the sidebar.
- Optionally set a label if you want the divider to describe the group below it.
- Leave the label empty when you only want spacing.

</details>

<details>
<summary><strong>Weather Card</strong></summary>

The weather card shows the current condition from a Home Assistant weather entity.

Use it for a compact current-weather view in the sidebar.

What to fill in:

- Select a `weather.*` entity.
- Optionally set a custom title.
- Make sure the Home Assistant weather integration exposes current condition and temperature data.

If the entity is unavailable or the add-on cannot reach Home Assistant, the card will show an unavailable or loading state.

</details>

<details>
<summary><strong>Weather Forecast Card</strong></summary>

The weather forecast card shows upcoming forecast data from Home Assistant.

Use it when you want an hourly or near-future weather overview in the sidebar.

What to fill in:

- Select a `weather.*` entity that supports forecast data.
- Optionally set a custom title.
- Confirm that the selected weather integration supports forecast calls in Home Assistant.

If the forecast remains empty, check the Home Assistant entity first. Some weather integrations expose current weather but no hourly forecast.

</details>

<details>
<summary><strong>Alarm Panel Card</strong></summary>

The alarm panel card controls a Home Assistant `alarm_control_panel.*` entity.

Use it for arming, disarming, and viewing the current alarm state from the sidebar.

What to fill in:

- Select the `alarm_control_panel.*` entity.
- Optionally set a custom title and icon.
- Enter a code only when your Home Assistant alarm requires a code to disarm. Arming does not require a code in Nova Panel.

The card sends service calls through the Nova Panel/Home Assistant proxy. If the card says Home Assistant is unreachable, check that the add-on is running through ingress and that the selected entity exists.

</details>

<details>
<summary><strong>Lights Status Card</strong></summary>

The lights status card summarizes lights and light-like entities, such as real `light.*` entities and selected `switch.*` entities that represent lamps.

Use it to see which lights are on and to define which entities should count as lights in Nova Panel.

What to fill in:

- Add domains that should be treated as lights, for example `light` and optionally `switch`.
- Select or ignore specific entities if needed.
- Rename entities when you want a cleaner display name inside Nova Panel.
- Override icons for entities that should look different from their Home Assistant icon.

The light button picker in the main area can use this sidebar card as its source, so a Shelly switch that is included here can also be selected as a lamp button.

</details>

<details>
<summary><strong>Openings Status Card</strong></summary>

The openings status card summarizes doors, windows, gates, and other open/closed sensors.

Use it to quickly see which openings are currently open.

What to fill in:

- Select the domains and device classes that represent openings, usually `binary_sensor` with door, window, garage door, opening, or similar device classes.
- Ignore entities that should not be shown.
- Rename entities for a cleaner household-friendly label.
- Optionally override icons when a sensor should be shown as a door, window, gate, or garage.

</details>

<details>
<summary><strong>Devices Status Card</strong></summary>

The devices status card summarizes active device-like entities.

Use it for grouped device status, for example switches, appliances, plugs, or other entities that should be visible when active.

What to fill in:

- Choose the domains and device classes that should be included.
- Ignore entities that create noise or do not belong on the panel.
- Rename entities or override icons where useful.

This card is intentionally flexible. It is best used after you decide which Home Assistant domains should count as "devices" for your household.

</details>

<details>
<summary><strong>Availability Status Card</strong></summary>

The availability status card shows entities that are unavailable, unknown, offline, or have low battery information.

Use it as a maintenance view for sensors, devices, and integrations that need attention.

What to fill in:

- Choose which domains should be monitored.
- Ignore entities that are expected to be unavailable or should not appear.
- Rename entities so the maintenance list is easy to scan.
- Use the battery tab to review low battery devices when battery entities are available.

</details>

<details>
<summary><strong>Media Hub Card</strong></summary>

The media hub card shows media players, current playback, volume controls, Spotify controls, radio shortcuts, and Music Assistant targets when configured.

Use it when the sidebar should act as the household media control center.

What to fill in:

- Select the `media_player.*` entities you want Nova Panel to follow.
- Ignore players that should not be shown.
- Configure Spotify credentials in Nova Panel settings if you want Spotify login and Spotify controls.
- Install and configure Music Assistant in Home Assistant if you want Spotify or radio streams to play through Music Assistant speaker targets.
- Make sure the speakers you want to control are exposed as Home Assistant media player entities.

Music Assistant is optional, but recommended when you want reliable playback routing to speakers from Spotify or radio sources.

</details>

<details>
<summary><strong>Energy Overview Card</strong></summary>

The energy overview card shows energy flow, daily totals, device usage, and optional custom background images.

Use it for a kiosk-friendly energy dashboard with solar, grid, battery, home usage, car charging, and device consumption.

What to fill in:

- Select power sensors for live values such as net power, solar power, grid power, battery power, and car charging power.
- Select energy sensors for daily totals such as import today, export today, solar today, home usage today, cost today, and compensation today.
- Optionally select device power sensors and matching kWh sensors to show appliance-level usage.
- Optionally upload custom images for day/night and car/no-car states.

Use Home Assistant sensors with clear units. Power values should usually be W or kW. Energy totals should usually be Wh or kWh.

</details>

### Main Area Cards

<details>
<summary><strong>Camera Strip Card</strong></summary>

The camera strip card shows camera snapshots in an Apple Home-style strip. Tapping a camera opens a larger camera popup.

Use it for security cameras, baby monitors, doorbells, or any Home Assistant `camera.*` entity.

What to fill in:

- Add one or more `camera.*` entities.
- Optionally set an alias for each camera.
- Mark cameras as large when they should take the bigger tile position.
- Enable Advanced Camera Card for a camera when you have the Advanced Camera Card custom card installed in Home Assistant.
- Optionally paste Advanced Camera Card YAML for a specific camera.

Advanced Camera Card example:

```yaml
type: custom:advanced-camera-card
cameras:
  - camera_entity: camera.example
live:
  auto_play:
    - visible
    - selected
  auto_unmute:
    - visible
    - selected
  show_image_during_load: true
```

The strip itself uses refreshed snapshots so hidden cameras do not keep playing in the background. Live playback starts in the camera popup.

</details>

<details>
<summary><strong>Week Calendar Card</strong></summary>

The week calendar card shows upcoming calendar events across multiple calendars. It can collapse into one column or expand across two columns when the screen size allows it.

Use it for family calendars, CalDAV calendars, shared schedules, school calendars, and personal calendars.

What to fill in:

- Add one or more `calendar.*` entities.
- Give each calendar a display name, such as a family member name.
- Choose a color per calendar.
- Optionally link a `person.*` entity to a calendar so Nova Panel can show that person's Home Assistant picture on calendar labels and events.
- Reorder the calendars to control the order shown at the top of the card.

All-day events are shown separately at the top. Timed events are placed in the time grid. Clicking a linked person opens the person location popup when person data is available.

</details>

<details>
<summary><strong>Light Button Card</strong></summary>

The light button card controls a lamp-like entity from the main area.

Use it for regular lights, dimmable lights, color lights, and switches that physically control lamps.

What to fill in:

- Select a `light.*` entity, or select a `switch.*` entity that you included in the Lights Status sidebar card.
- Set the display name if the Home Assistant friendly name is not what you want.
- Set an icon with an MDI icon name, for example `mdi:lightbulb-outline`, `mdi:ceiling-light-outline`, or `mdi:floor-lamp-outline`.
- Save the card.

How it works:

- Press the icon area to toggle the lamp on or off.
- Press the rest of the card to open the detail popup.
- Dimmable lights show a vertical brightness control.
- Non-dimmable lamps and switches show a HomeKit-style on/off pill.
- Color-capable lights show color controls in the popup.

</details>

<details>
<summary><strong>Climate Button Card</strong></summary>

The climate button card controls a Home Assistant `climate.*` entity.

Use it for thermostats, heating zones, air conditioning, or room climate controls.

What to fill in:

- Select the `climate.*` entity.
- Optionally set a custom display name.
- Optionally set an MDI icon, for example `mdi:thermostat`.

The card shows the current temperature and target temperature when those attributes are available. The popup exposes the climate controls supported by the selected Home Assistant entity.

</details>

<details>
<summary><strong>Cover Button Card</strong></summary>

The cover button card controls a Home Assistant `cover.*` entity.

Use it for curtains, blinds, shutters, garage doors, or other open/close covers.

What to fill in:

- Select the `cover.*` entity.
- Optionally set a custom display name.
- Optionally set an MDI icon, for example `mdi:curtains`, `mdi:blinds`, or `mdi:garage`.

The popup uses a vertical position control where open and closed follow the Home Assistant cover position. Open, stop, and close buttons remain available below the slider.

</details>

<details>
<summary><strong>Vacuum Button Card</strong></summary>

The vacuum button card controls a Home Assistant `vacuum.*` entity.

Use it for robot vacuums and mop/vacuum combinations.

What to fill in:

- Select the `vacuum.*` entity.
- Optionally set a custom display name.
- Optionally set an MDI icon, for example `mdi:robot-vacuum`.

The card shows the current vacuum state. The popup provides common controls such as start, pause, stop, and return to dock when Home Assistant exposes those actions.

</details>

<details>
<summary><strong>Media Player Button Card</strong></summary>

The media player button card controls one `media_player.*` entity from the main area.

Use it for a TV, receiver, speaker, soundbar, or Music Assistant player that deserves its own button in a room section.

What to fill in:

- Select the `media_player.*` entity.
- Optionally set a custom display name.
- Optionally set an MDI icon, for example `mdi:speaker`, `mdi:television`, or `mdi:audio-video`.

The card shows the current playback state where available. The popup provides media controls and volume controls for the selected entity.

</details>
