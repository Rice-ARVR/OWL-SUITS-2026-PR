# How to Build a Telemetry Feature: Step-by-Step

This guide walks through how to build a page that reads live telemetry data — the pattern used by every monitor in this project.

---

## How Telemetry Reaches the Frontend

Telemetry no longer flows through individual HTTP requests. Instead, a single persistent WebSocket connection delivers every data point to the client the moment the backend receives it from TSS.

```
TSS (UDP, every 1s)
     │
     ▼
server/app/services/telemetry/telemetry_service.py   ← polls TSS, updates in-memory data
     │  _poll_once() completes
     ▼
server/app/services/telemetry/telemetry_ws_service.py ← serializes full snapshot to JSON
     │  broadcasts to all connected clients
     ▼
ws://localhost:8000/ws/telemetry                      ← WebSocket endpoint
     │
     ▼
client/app/lib/telemetryManager.ts                    ← singleton, caches latest snapshot
     │  notifies subscribers
     ▼
client/app/hooks/useTelemetry.ts                      ← re-renders component on new data
     │
     ▼
Your React component                                  ← calls typed getter methods
```

You do **not** need to create a backend service, router, or HTTP endpoint to read telemetry values. All of that is handled by the shared system above.

---

## What You're Building

A page that displays live rover and EVA data, updating automatically every time the backend receives a new snapshot from TSS (~1 second).

---

## Step 1 — Use the `useTelemetry` Hook

**File to create:** `client/app/features/examples/TssExample.tsx`

Import `useTelemetry` and call the typed getter methods you need. That's it — no `useEffect`, no `fetch`, no state management.

```tsx
// client/app/features/examples/TssExample.tsx

import { useTelemetry } from "~/hooks/useTelemetry";
import styles from "./TssExample.module.css";

export default function TssExample() {
  // Connect to the TelemetryManager singleton and subscribe to updates.
  // The component re-renders automatically each time new data arrives.
  const telemetry = useTelemetry();

  // Show a status message until the first snapshot arrives.
  if (!telemetry.isReady()) {
    return (
      <p className={styles.loading}>
        {telemetry.getConnectionStatus() === "connecting"
          ? "Connecting..."
          : "Waiting for telemetry..."}
      </p>
    );
  }

  const rows: { label: string; value: string }[] = [
    {
      label: "EVA Heart Rate",
      value: telemetry.getEva1HeartRate()?.toFixed(2) ?? "—",
    },
    {
      label: "EVA Temperature",
      value: telemetry.getEva1Temperature()?.toFixed(2) ?? "—",
    },
    {
      label: "LTV Signal Strength",
      value: String(telemetry.getLtvSignalStrength() ?? "—"),
    },
    {
      label: "LTV Last Known X",
      value: String(telemetry.getLtvLocation()?.x ?? "—"),
    },
    {
      label: "Rover Speed",
      value: String(telemetry.getRoverSpeed() ?? "—"),
    },
    {
      label: "Rover Battery Level",
      value: telemetry.getRoverBatteryLevel()?.toFixed(2) ?? "—",
    },
  ];

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>TSS Example</h1>
      <table className={styles.table}>
        <tbody>
          {rows.map(({ label, value }) => (
            <tr key={label}>
              <td>{label}</td>
              <td>{value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

**What getters are available?** Open `client/app/lib/telemetryManager.ts` and look at all the `get*` methods. They mirror every field in these backend model files:

- `server/app/models/eva.py` — spacesuit biometrics, oxygen, pressure, IMU position
- `server/app/models/rover.py` — speed, battery, position, cabin systems
- `server/app/models/ltv.py` — location, signal strength
- `server/app/models/ltv_errors.py` — error codes and procedures

If no snapshot has arrived yet, every getter returns `null` — always guard with `?? "—"` or a null check.

---

## Step 2 — Write the CSS Module

**File to create:** `client/app/features/examples/TssExample.module.css`

CSS Modules are scoped to the component that imports them. Class names are accessed as `styles.className` in JSX.

```css
/* client/app/features/examples/TssExample.module.css */

.container {
  padding: 2rem;
  max-width: 480px;
}

.title {
  font-size: 1.25rem;
  font-weight: 600;
  margin-bottom: 1rem;
}

.table {
  width: 100%;
  border-collapse: collapse;
}

.table td {
  padding: 0.5rem 0.75rem;
  border-bottom: 1px solid #e5e7eb;
}

/* Left column: muted label */
.table td:first-child {
  color: #6b7280;
  white-space: nowrap;
}

/* Right column: tabular-nums ensures digits align vertically */
.table td:last-child {
  font-variant-numeric: tabular-nums;
  text-align: right;
}

.loading {
  padding: 2rem;
  color: #6b7280;
}
```

---

## Step 3 — Write the Route File

**File to create:** `client/app/routes/tss_example.tsx`

Route files are intentionally thin — they connect a URL to a feature component and nothing more.

```tsx
// client/app/routes/tss_example.tsx

import TssExample from "~/features/examples/TssExample";

export default function TssExamplePage() {
  return <TssExample />;
}
```

---

## Step 4 — Register the Frontend Route

**File to edit:** `client/app/routes.ts`

```ts
// client/app/routes.ts

import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("tss_example", "routes/tss_example.tsx"),
] satisfies RouteConfig;
```

After this step, navigating to `http://localhost:5173/tss_example` renders the live telemetry table.

---

## Summary: All Files Touched

| File | Action | Purpose |
|------|--------|---------|
| `client/app/features/examples/TssExample.tsx` | Create | Read telemetry via `useTelemetry()` and render the table |
| `client/app/features/examples/TssExample.module.css` | Create | Scoped styles for the component |
| `client/app/routes/tss_example.tsx` | Create | Thin route entry point |
| `client/app/routes.ts` | Edit | Register the `/tss_example` URL |

No backend files need to be created or edited to read telemetry values.

---

## Adding a New Telemetry Getter

If you need a value that is not yet exposed by `TelemetryManager`, add a getter to `client/app/lib/telemetryManager.ts`:

```ts
// client/app/lib/telemetryManager.ts

getRoverSurfaceIncline(): number | null {
  return this.data?.rover.pr_telemetry.surface_incline ?? null;
}
```

The full shape of available data is defined in `client/app/types/telemetry.ts`, which mirrors the Pydantic schemas in `server/app/models/`.

---

## When You Still Need a Backend Endpoint

The WebSocket system covers all **telemetry reads**. You still need to create a backend service + router for:

- **Write operations** — sending commands to TSS (e.g. rover throttle, steering)
- **Database operations** — saving or loading data from MongoDB
- **Non-telemetry logic** — speech transcription, RAG queries, navigation algorithms

For those cases, follow the HTTP pattern:

1. Write a service in `server/app/services/`
2. Write a router in `server/app/routers/`
3. Register it in `server/main.py` with `app.include_router(...)`
4. Call it from the frontend with `fetch()` or a custom hook
