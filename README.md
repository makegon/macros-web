# Building People Counter

Offline-friendly React/Vite SPA for counting current building occupancy from a local camera API.

## Requirements

- Node.js and npm installed before preparing the app.
- Dependencies installed ahead of offline use.
- Microsoft Edge or Google Chrome on the Windows computer that will run the built app.
- Access from the browser to the camera server on the local network.

The app does not use CDN assets, external fonts, external images, or cloud services at runtime.

## Install Dependencies

Run this once while npm packages are available:

```bash
npm install
```

If `package-lock.json` is already present and you want an exact install, use:

```bash
npm ci
```

## Run In Development

```bash
npm run dev
```

Vite starts a local development server on `127.0.0.1`. Open the URL printed in the terminal.

## Run Tests

```bash
npm test
```

## Build Static Files

```bash
npm run build
```

The production build is written to `dist/`. Vite is configured with `base: "./"` so built assets use relative paths and can load when `index.html` is opened from disk.

## Use On Windows

1. Build the app with `npm run build`.
2. Copy the whole `dist/` folder to the Windows computer.
3. Open `dist/index.html` in Microsoft Edge or Google Chrome.
4. If the browser blocks camera HTTP requests because of `file://` or CORS restrictions, run the app through a local static server instead:

```bash
npm run preview
```

Then open the preview URL shown in the terminal.

## Change Server

Use the `Server` input in the UI. The default value is:

```text
192.168.0.197:8080
```

Click `OK` to connect or reconnect. The app accepts values with or without protocol, for example `192.168.0.197:8080`, `http://192.168.0.197:8080`, or `https://192.168.0.197:8080`. Requests are sent to:

```text
http://{server}/api/objects_counting/current_counters
```

## Reset Counter

Enter a number in `Reset Counts` and click `reset`.

The visible `Person Counts` value is set to that number. If latest camera totals are available, the app re-baselines from those totals so future deltas continue from the reset value.

## Local Cache

The app saves state in browser `localStorage` under this key:

```text
building-person-counter-state-v1
```

Saved state includes:

- server address
- reset value
- current counter state
- latest total IN and OUT counters

## Clear Browser Cache

To clear the app state in Edge or Chrome:

1. Open DevTools with `F12`.
2. Go to `Application`.
3. Open `Local Storage`.
4. Select the page origin.
5. Delete `building-person-counter-state-v1`.

You can also clear site data for the page from browser settings if needed.
