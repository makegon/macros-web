# AGENTS.md

## Project: Building People Counter

### Role for Codex
You are a senior frontend engineer building a small offline-first Windows-friendly web application for a local network. Implement the app according to this specification, keep the code simple, testable, and runnable without internet access after dependencies are installed.

## Goal
Build a web application that calculates how many employees are currently inside a building.

The app polls a surveillance camera HTTP API every 5 seconds. It reads absolute people counters from zones named `IN` and `OUT`, aggregates them across all channels, and updates a local building occupancy counter using delta calculation.

## Recommended technology stack

### Primary stack
- Language: TypeScript
- UI: React
- Build tool: Vite
- Test runner: Vitest
- DOM testing: Testing Library, optional
- Runtime target: Static HTML/CSS/JS opened locally in Microsoft Edge or Chrome on Windows
- Persistent local cache: Browser File System Access API when available, with `localStorage` fallback
- Styling: Plain CSS or CSS modules
- Packaging: Static `dist/` folder that can be copied to a Windows PC and opened through `index.html`

### Why this stack
- Produces a simple static app.
- Works without a backend.
- TypeScript helps prevent DTO and counter-logic mistakes.
- Vitest gives fast unit test coverage for aggregation and delta behavior.
- Vite can build all assets into static files.
- File System Access API supports writing a local cache file on Chromium-based browsers on Windows.
- `localStorage` fallback keeps the app usable if direct file writing is unavailable.

### Important browser constraints
- A plain local `file://` HTML app can call HTTP APIs only if the browser allows the request and the camera server permits CORS.
- If CORS blocks requests from `file://`, provide an optional local launcher mode using a tiny static server, for example `npx vite preview --host 127.0.0.1`, or a packaged local executable later.
- Do not require internet access at runtime.
- Do not use cloud services.

## Functional requirements

### API
Endpoint template:

```text
GET http://{server}/api/objects_counting/current_counters
```

Default server:

```text
192.168.0.197:8080
```

Authorization:

```text
Basic Auth
Username: Root
Password: empty string
```

Polling interval: 5 seconds.

Expected response structure:

```ts
interface ApiResponse {
  Channels?: Channel[];
}

interface Channel {
  Zones?: Zone[];
}

interface Zone {
  Name?: string;
  CurrentCounts?: {
    Person?: number;
  };
}
```

Only zones with exact `Name` equal to `IN` or `OUT` are relevant.

### UI requirements
The app must display:
- Server address input.
- OK button to connect or reconnect.
- Reset count input.
- Reset button.
- Current people count display.
- Connection status.
- Last update time.
- Error display.
- Optional diagnostic values: Total IN, Total OUT, previous IN baseline, previous OUT baseline.

### Server address behavior
The server address must be editable.

Example input:

```text
192.168.0.197:8080
```

When the user clicks OK, connect to:

```text
http://192.168.0.197:8080/api/objects_counting/current_counters
```

Validate that the address is not empty and does not contain a path. It may contain host or IPv4 plus optional port.

### Aggregation logic
For every successful API response:
- Sum `CurrentCounts.Person` for all zones where `Name === "IN"`.
- Sum `CurrentCounts.Person` for all zones where `Name === "OUT"`.
- Aggregate across all channels.
- Missing channels, missing zones, missing counts, and non-number values must not crash the app.
- Prefer treating missing or invalid person counts as `0` and surfacing a non-fatal warning if useful.

### Counter logic
The app must not repeatedly add the same absolute API counters.

On first successful response:
- Store `totalIn` and `totalOut` as baseline.
- Do not change `currentPeopleCount`.

On each next successful response:

```ts
deltaIn = latestTotalIn - previousTotalIn;
deltaOut = latestTotalOut - previousTotalOut;
currentPeopleCount = currentPeopleCount + deltaIn - deltaOut;
previousTotalIn = latestTotalIn;
previousTotalOut = latestTotalOut;
```

### External counter reset logic
If `latestTotalIn < previousTotalIn`, the external IN counter probably reset.

If `latestTotalOut < previousTotalOut`, the external OUT counter probably reset.

In this case:
- Do not apply a negative delta.
- Re-baseline only the affected counter.
- Keep `currentPeopleCount` unchanged for that affected counter event.
- Still apply a valid positive delta from the other counter if it did not reset.

Recommended safe logic:

```ts
let deltaIn = 0;
let deltaOut = 0;

if (latestTotalIn >= previousTotalIn) {
  deltaIn = latestTotalIn - previousTotalIn;
}

if (latestTotalOut >= previousTotalOut) {
  deltaOut = latestTotalOut - previousTotalOut;
}

currentPeopleCount = currentPeopleCount + deltaIn - deltaOut;
previousTotalIn = latestTotalIn;
previousTotalOut = latestTotalOut;
```

### Reset logic
The user enters `resetCount` and clicks Reset.

Then:
- `currentPeopleCount = resetCount`.
- Future calculations continue from this value.
- If latest API totals are available, use them as the new baseline:

```ts
previousTotalIn = latestTotalIn;
previousTotalOut = latestTotalOut;
```

- Persist the reset value and latest baselines in local cache.

### Persistence requirements
Persist the app state locally so it can be restored on later starts:
- Server address.
- Current people count.
- Previous total IN baseline.
- Previous total OUT baseline.
- Latest total IN.
- Latest total OUT.
- Last update time.

Use a small JSON cache object:

```ts
interface AppCache {
  version: 1;
  serverAddress: string;
  currentPeopleCount: number;
  previousTotalIn: number | null;
  previousTotalOut: number | null;
  latestTotalIn: number | null;
  latestTotalOut: number | null;
  lastUpdateIso: string | null;
}
```

Persistence implementation priority:
1. `localStorage` as automatic baseline persistence.
2. Optional `Save cache file` / `Load cache file` buttons using the File System Access API for a physical JSON file, when supported.

Do not make direct file writing mandatory because a plain browser app cannot silently write arbitrary files without user permission.

### Error handling
The app must handle and display errors without crashing:
- Invalid server address.
- Network errors.
- Timeout.
- Non-success HTTP status codes.
- Invalid JSON.
- Missing fields.
- Empty channels.
- Empty zones.
- CORS or browser security errors.

Timeout recommendation: abort request after 4 seconds so that the next 5-second poll does not overlap.

### HTTP client requirements
- Generate URL as `http://${serverAddress}/api/objects_counting/current_counters`.
- Basic Auth header must be:

```text
Authorization: Basic Um9vdDo=
```

This is Base64 for `Root:`.

- Use `fetch` with `AbortController` for timeout.
- Never start a new request while a previous request is still pending.

### Suggested source structure

```text
src/
  App.tsx
  main.tsx
  styles.css
  api/
    peopleCounterClient.ts
    peopleCounterDto.ts
  domain/
    aggregateCounters.ts
    counterState.ts
  storage/
    appCache.ts
    fileCache.ts
  test/
    fixtures.ts
```

### Suggested implementation details

#### `aggregateCounters.ts`
Pure function:

```ts
export function aggregateCounters(dto: unknown): { totalIn: number; totalOut: number; warnings: string[] }
```

Rules:
- Accept `unknown`.
- Safely parse object shape.
- Sum exact zone names `IN` and `OUT`.
- Ignore all other zones.
- Return warnings for malformed but recoverable input.

#### `counterState.ts`
Pure reducer-style functions:

```ts
export interface CounterState {
  currentPeopleCount: number;
  previousTotalIn: number | null;
  previousTotalOut: number | null;
  latestTotalIn: number | null;
  latestTotalOut: number | null;
}

export function applyTotals(state: CounterState, totals: { totalIn: number; totalOut: number }): CounterState
export function resetCounter(state: CounterState, resetCount: number): CounterState
```

Keep business logic out of React components.

#### `peopleCounterClient.ts`
Functions:

```ts
export function buildCountersUrl(serverAddress: string): string
export function buildBasicAuthHeader(username?: string, password?: string): string
export async function fetchCurrentCounters(serverAddress: string, timeoutMs?: number): Promise<unknown>
```

Defaults:
- username: `Root`
- password: empty string
- timeoutMs: `4000`

## Test requirements
Use Vitest. Required coverage:
- DTO deserialization / safe parsing.
- IN/OUT aggregation across multiple channels.
- Delta calculation.
- Reset behavior.
- First response baseline behavior.
- Repeated identical response behavior.
- External counter reset behavior.
- HTTP client URL generation.
- Basic Auth header.

### Required test cases

#### Aggregation
Input with several channels and zones:
- IN values: 10, 5.
- OUT values: 3, 2.
- Other zone: 999.
Expected:
- totalIn = 15.
- totalOut = 5.

#### First baseline
Initial state:

```ts
currentPeopleCount = 0
previousTotalIn = null
previousTotalOut = null
```

Apply totals:

```ts
totalIn = 100
totalOut = 20
```

Expected:
- currentPeopleCount remains 0.
- previousTotalIn = 100.
- previousTotalOut = 20.

#### Delta update
State baseline:

```ts
currentPeopleCount = 50
previousTotalIn = 100
previousTotalOut = 20
```

Apply totals:

```ts
totalIn = 110
totalOut = 25
```

Expected:
- deltaIn = 10.
- deltaOut = 5.
- currentPeopleCount = 55.

#### Repeated identical response
State baseline:

```ts
currentPeopleCount = 55
previousTotalIn = 110
previousTotalOut = 25
```

Apply same totals again.

Expected:
- currentPeopleCount remains 55.

#### External reset
State baseline:

```ts
currentPeopleCount = 55
previousTotalIn = 110
previousTotalOut = 25
```

Apply totals:

```ts
totalIn = 3
totalOut = 30
```

Expected:
- IN reset is ignored for delta.
- OUT delta is 5.
- currentPeopleCount = 50.
- previousTotalIn = 3.
- previousTotalOut = 30.

#### User reset
State:

```ts
currentPeopleCount = 50
latestTotalIn = 120
latestTotalOut = 35
```

Reset to 20.

Expected:
- currentPeopleCount = 20.
- previousTotalIn = 120.
- previousTotalOut = 35.

#### URL generation
Input:

```text
192.168.0.197:8080
```

Expected:

```text
http://192.168.0.197:8080/api/objects_counting/current_counters
```

#### Basic Auth
Expected header:

```text
Basic Um9vdDo=
```

## Development workflow for Codex

### Step 1: Bootstrap project
Create a Vite React TypeScript project. Keep dependencies minimal. Add Vitest.

Expected commands:

```bash
npm create vite@latest building-people-counter -- --template react-ts
cd building-people-counter
npm install
npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom
```

Then update `package.json` scripts:

```json
{
  "scripts": {
    "dev": "vite --host 127.0.0.1",
    "build": "tsc -b && vite build",
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

### Step 2: Implement pure domain logic first
Implement:
- `aggregateCounters.ts`
- `counterState.ts`

Add unit tests before wiring UI.

### Step 3: Implement HTTP client
Implement:
- URL builder.
- Basic Auth header builder.
- Fetch with timeout.
- Non-OK HTTP status error handling.
- JSON parse error handling.

Add tests for URL and header.

### Step 4: Implement storage
Implement:
- `localStorage` cache save/load.
- Cache schema validation with defaults.
- Optional import/export JSON file helpers.

### Step 5: Implement UI
Build a simple UI similar to the provided desktop mockup:
- Card-like centered layout.
- Large blue current count.
- Server row with input and OK button.
- Reset row with numeric input and Reset button.
- Status, last update, error area, diagnostics.

### Step 6: Implement polling
- Start polling after OK click and on app load using cached/default server address.
- Poll every 5 seconds.
- Abort after 4 seconds.
- Prevent overlapping requests.
- On success, aggregate, apply counter logic, update UI and cache.
- On failure, display error and continue future polling attempts.

### Step 7: Build and verify offline runtime
- Run tests.
- Build `dist/`.
- Copy `dist/` to a Windows machine.
- Open `index.html` in Microsoft Edge or Chrome.
- Confirm whether the camera API allows browser CORS from local files.
- If blocked, run through a local static server on the Windows machine.

## Codex prompts

### Prompt 1: Create the project skeleton
```text
Create a Vite React TypeScript app named building-people-counter. Add Vitest test setup. Use a minimal dependency set. Configure scripts for dev, build, test, and test:watch. Create folders src/api, src/domain, src/storage, and src/test. Do not implement UI yet.
```

### Prompt 2: Implement aggregation logic with tests
```text
Implement src/domain/aggregateCounters.ts as a pure TypeScript function that accepts unknown API data and returns totalIn, totalOut, and warnings. It must safely aggregate CurrentCounts.Person for zones named exactly IN and OUT across all Channels and ignore other zones. Handle missing Channels, missing Zones, empty arrays, malformed fields, and non-number values without throwing. Add Vitest tests for multi-channel aggregation, empty channels, empty zones, missing fields, and invalid person values.
```

### Prompt 3: Implement counter state logic with tests
```text
Implement src/domain/counterState.ts with CounterState, applyTotals, and resetCounter. applyTotals must baseline on the first successful response without changing currentPeopleCount, then use deltaIn and deltaOut for later responses. Repeated identical totals must not change the count. If a latest total is lower than the previous baseline, treat it as an external counter reset, ignore the negative delta for that counter, and re-baseline it. resetCounter must set currentPeopleCount to the user's reset value and use latestTotalIn/latestTotalOut as new baselines when available. Add Vitest tests for first baseline, normal delta update, repeated identical response, external reset, and user reset.
```

### Prompt 4: Implement HTTP client with tests
```text
Implement src/api/peopleCounterClient.ts. Add buildCountersUrl(serverAddress), buildBasicAuthHeader(username = 'Root', password = ''), and fetchCurrentCounters(serverAddress, timeoutMs = 4000). The URL must be http://{server}/api/objects_counting/current_counters. The default Basic Auth header must be Basic Um9vdDo=. fetchCurrentCounters must use fetch, AbortController timeout, no-cache headers, throw clear errors for invalid server address, timeout, network errors, non-OK HTTP status, and invalid JSON. Add tests for URL generation and Basic Auth header.
```

### Prompt 5: Implement cache storage
```text
Implement src/storage/appCache.ts. Define AppCache version 1 with serverAddress, currentPeopleCount, previousTotalIn, previousTotalOut, latestTotalIn, latestTotalOut, and lastUpdateIso. Provide loadCache and saveCache using localStorage with safe schema validation and defaults. Never throw from loadCache. Add optional export/import helpers that serialize and parse JSON for a manually selected cache file.
```

### Prompt 6: Build the React UI
```text
Implement the React UI in src/App.tsx and src/styles.css. The UI should match a simple Windows-style Person Counter panel: server input with OK button, large current people count display, reset count numeric input with Reset button, connection status, last update time, error display, and diagnostics for Total IN and Total OUT. Keep business logic in domain modules, not in the component. Use accessible labels and buttons.
```

### Prompt 7: Add polling and integrate everything
```text
Wire the app together. On load, restore cache or use default server 192.168.0.197:8080. On OK click, validate the server, reconnect, and poll the endpoint every 5 seconds. Each request must timeout after 4 seconds and requests must not overlap. On success, aggregate counters, apply counter logic, update latest totals, status, last update time, and save cache. On error, show the error but keep future polling active. Reset must set the current count and re-baseline using latest totals if available.
```

### Prompt 8: Final hardening
```text
Review the whole app for offline/local-network usage on Windows. Ensure npm test and npm run build pass. Ensure the app does not require internet access at runtime. Add a README section explaining how to build, copy dist to Windows, open index.html, and what to do if the browser blocks HTTP requests because of CORS or file:// restrictions. Keep the implementation simple and maintainable.
```

## Definition of done
- `npm test` passes.
- `npm run build` passes.
- Static build works from `dist/`.
- Server can be edited and reconnected.
- Basic Auth request is sent.
- Polling happens every 5 seconds without overlap.
- Current people count uses delta logic, not repeated absolute addition.
- Reset works and persists.
- Local cache restores state on restart.
- Errors are visible and do not crash the app.
