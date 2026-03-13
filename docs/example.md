# How to Build a TSS Feature: Step-by-Step

This guide walks through exactly how the `/tss_example` feature was built — from a blank slate to a working page that fetches live telemetry data. Follow these steps when adding any new feature to this project.

---

## What You're Building

A page at `http://localhost:5173/tss_example` that:

1. The React frontend requests data from the backend at `GET /tss_example`
2. The FastAPI backend reads live telemetry from the in-memory TSS data objects
3. The frontend displays the result in a table

---

## The Full Stack at a Glance

```
Browser (React)
     │  fetch("/tss_example")
     ▼
server/app/routers/tss_example.py       ← receives the HTTP request
     │  calls get_tss_example()
     ▼
server/app/services/example/tss_example_service.py  ← reads from telemetry
     │  calls telemetry_service.eva_data.get_eva1_heart_rate(), etc.
     ▼
server/app/services/telemetry/telemetry_service.py  ← in-memory data, polled every 1s from TSS
```

---

## Step 1 — Write the Service

**File to create:** `server/app/services/example/tss_example_service.py`

The service is the brain. It reads values from the global in-memory telemetry objects and returns a plain Python dict. It knows nothing about HTTP.

```python
# server/app/services/example/tss_example_service.py

# Import the module that holds the live telemetry data objects.
# These objects are updated every second by a background polling loop.
import app.services.telemetry.telemetry_service as telemetry_service


async def get_tss_example() -> dict:
    # Each getter is async because the data objects use asyncio.Lock
    # for thread safety. We await each one individually.
    return {
        "eva_heart_rate": await telemetry_service.eva_data.get_eva1_heart_rate(),
        "eva_temperature": await telemetry_service.eva_data.get_eva1_temperature(),
        "ltv_signal_strength": await telemetry_service.ltv_data.get_signal_strength(),
        "ltv_last_known_x": await telemetry_service.ltv_data.get_location_last_known_x(),
        "rover_speed": await telemetry_service.rover_data.get_pr_speed(),
        "rover_battery_level": await telemetry_service.rover_data.get_pr_battery_level(),
    }
```

**What data is available?** Open these model files and look at all the `async def get_*` methods:
- `server/app/models/eva.py` — spacesuit biometrics, oxygen, pressure, IMU position
- `server/app/models/rover.py` — speed, battery, position, cabin systems
- `server/app/models/ltv.py` — location, signal strength
- `server/app/models/ltv_errors.py` — error codes and procedures

---

## Step 2 — Write the Router

**File to create:** `server/app/routers/tss_example.py`

The router defines the URL endpoint. Its only job is to receive an HTTP request, call the service, and return the response. No logic lives here.

```python
# server/app/routers/tss_example.py

from fastapi import APIRouter
from fastapi.responses import JSONResponse

# Import the service function we wrote in Step 1
from app.services.example.tss_example_service import get_tss_example

# Every router file needs its own APIRouter instance
router = APIRouter()


# This decorator registers the URL path and HTTP method.
# GET /tss_example will trigger this function.
@router.get("/tss_example")
async def tss_example():
    data = await get_tss_example()  # delegate to the service
    return JSONResponse(data)       # serialize to JSON and send
```

**What is a route?** A route is a URL path + HTTP method pair (e.g. `GET /tss_example`). When the React frontend calls `fetch("/tss_example")`, FastAPI looks up which function is registered for `GET /tss_example` and runs it.

---

## Step 3 — Register the Router in `main.py`

**File to edit:** `server/main.py`

FastAPI does not discover routers automatically. You must import and register each one.

```python
# server/main.py

# Add this import alongside the existing router imports
from app.routers.tss_example import router as tss_example_router

# ...existing app setup...

# Add this line in the "Include Routers Here" section
app.include_router(tss_example_router)
```

After this step, `http://localhost:8000/tss_example` is live. You can test it directly in a browser or with `curl http://localhost:8000/tss_example`.

---

## Step 4 — Write the Frontend Component

**File to create:** `client/app/features/examples/TssExample.tsx`

The component fetches data from the backend and renders it. It lives in `features/` because it belongs to the `examples` feature domain.

```tsx
// client/app/features/examples/TssExample.tsx

import { useEffect, useState } from "react";

// CSS Module — styles are locally scoped to this component (see Step 5)
import styles from "./TssExample.module.css";

// TypeScript interface — mirrors the shape of the dict returned by the service.
// If the service adds a field, add it here too.
interface TssData {
  eva_heart_rate: number;
  eva_temperature: number;
  ltv_signal_strength: number;
  ltv_last_known_x: number;
  rover_speed: number;
  rover_battery_level: number;
}

// ROWS drives the table. Adding a new row means adding one entry here —
// no changes needed elsewhere in the component.
// `key` must exactly match a field name from TssData.
// `decimals` is optional — omit it to display the raw value.
const ROWS: { label: string; key: keyof TssData; decimals?: number }[] = [
  { label: "EVA Heart Rate",       key: "eva_heart_rate",       decimals: 2 },
  { label: "EVA Temperature",      key: "eva_temperature",      decimals: 2 },
  { label: "LTV Signal Strength",  key: "ltv_signal_strength" },
  { label: "LTV Last Known X",     key: "ltv_last_known_x" },
  { label: "Rover Speed",          key: "rover_speed" },
  { label: "Rover Battery Level",  key: "rover_battery_level",  decimals: 2 },
];

export default function TssExample() {
  // `data` holds the fetched payload. null = not yet loaded.
  const [data, setData] = useState<TssData | null>(null);
  // `error` holds a message if the fetch fails.
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // VITE_API_URL is set in the .env file (e.g. http://localhost:8000).
    // Fall back to localhost if the variable is missing.
    const apiUrl = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

    fetch(`${apiUrl}/tss_example`)
      .then((res) => res.json())   // parse the JSON body
      .then(setData)               // store it in state, triggering a re-render
      .catch((err: Error) => setError(err.message));  // surface fetch errors
  }, []); // empty dependency array = run once on mount

  // Render error and loading states before the main UI
  if (error) return <p className={styles.error}>{error}</p>;
  if (!data)  return <p className={styles.loading}>Loading...</p>;

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>TSS Example</h1>
      <table className={styles.table}>
        <tbody>
          {ROWS.map(({ label, key, decimals }) => (
            <tr key={key}>
              <td>{label}</td>
              <td>
                {/* toFixed(n) rounds to n decimal places. */}
                {/* Only apply it when decimals is explicitly set. */}
                {decimals !== undefined
                  ? (data[key] as number).toFixed(decimals)
                  : data[key]}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

---

## Step 5 — Write the CSS Module

**File to create:** `client/app/features/examples/TssExample.module.css`

CSS Modules are scoped to the component that imports them. Class names in the file are accessed as `styles.className` in JSX — there are no global name collisions.

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

/* Style every cell */
.table td {
  padding: 0.5rem 0.75rem;
  border-bottom: 1px solid #e5e7eb;
}

/* Left column: muted label */
.table td:first-child {
  color: #6b7280;
  white-space: nowrap;
}

/* Right column: right-aligned numbers with consistent digit widths */
.table td:last-child {
  font-variant-numeric: tabular-nums;
  text-align: right;
}

.loading {
  padding: 2rem;
  color: #6b7280;
}

.error {
  padding: 2rem;
  color: #dc2626;
}
```

---

## Step 6 — Write the Route File

**File to create:** `client/app/routes/tss_example.tsx`

Route files in React Router v7 are intentionally thin. They connect a URL to a feature component and nothing more. Logic stays in the feature component.

```tsx
// client/app/routes/tss_example.tsx

// Import the real component from the features folder
import TssExample from "~/features/examples/TssExample";

// This default export is what React Router renders when the route is matched
export default function TssExamplePage() {
  return <TssExample />;
}
```

**Why the split?** Route files are entry points — they get auto-code-split by Vite. The feature component is the actual UI. Keeping them separate means the component can be reused on multiple pages if needed.

---

## Step 7 — Register the Frontend Route

**File to edit:** `client/app/routes.ts`

React Router v7 uses a central route config file. Add one line per new page.

```ts
// client/app/routes.ts

import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  // "tss_example" is the URL path, the second arg is the file path
  route("tss_example", "routes/tss_example.tsx"),
] satisfies RouteConfig;
```

After this step, navigating to `http://localhost:5173/tss_example` renders the component.

---

## Summary: All Files Touched

| File | Action | Purpose |
|------|--------|---------|
| `server/app/services/example/tss_example_service.py` | Create | Read telemetry values, return a dict |
| `server/app/routers/tss_example.py` | Create | Expose `GET /tss_example` endpoint |
| `server/main.py` | Edit | Register the new router |
| `client/app/features/examples/TssExample.tsx` | Create | Fetch data and render the table |
| `client/app/features/examples/TssExample.module.css` | Create | Scoped styles for the component |
| `client/app/routes/tss_example.tsx` | Create | Thin route entry point |
| `client/app/routes.ts` | Edit | Register the `/tss_example` URL |

---

## How Commenting Works in This Project

### Python (backend)

Use plain inline comments with `#` for non-obvious logic. Docstrings (`"""..."""`) are for public functions that are not immediately self-explanatory.

```python
# Bad — states the obvious
# Import the router
from app.routers.tss_example import router as tss_example_router

# Good — explains why, not what
# Each getter is async because the data objects use asyncio.Lock for thread safety
return {
    "eva_heart_rate": await telemetry_service.eva_data.get_eva1_heart_rate(),
}
```

### TypeScript / TSX (frontend)

Use `//` for single-line comments and `{/* */}` inside JSX. Comment the intent behind non-obvious decisions, not what the code literally does.

```tsx
// Good — explains a non-obvious conditional
{/* Only apply toFixed when decimals is explicitly set (undefined check, not falsy) */}
{decimals !== undefined
  ? (data[key] as number).toFixed(decimals)
  : data[key]}

// Good — explains a config fallback
// Fall back to localhost if VITE_API_URL is not set in .env
const apiUrl = import.meta.env.VITE_API_URL ?? "http://localhost:8000";
```

### CSS

Use `/* */` comments to group sections or explain non-obvious property choices.

```css
/* tabular-nums ensures digits align vertically in the column */
font-variant-numeric: tabular-nums;
```

---

## How the Frontend Talks to the Backend

1. The component calls `fetch("http://localhost:8000/tss_example")` on mount.
2. FastAPI receives `GET /tss_example` and runs the matching router function.
3. The router calls `get_tss_example()` in the service.
4. The service reads from `telemetry_service.eva_data`, `.ltv_data`, and `.rover_data` — Python objects that hold the latest TSS data, refreshed every second.
5. The service returns a Python dict. The router wraps it in `JSONResponse`.
6. The browser receives `{ "eva_heart_rate": 80.5, "rover_speed": 1.2, ... }`.
7. React stores that in state with `setData(...)`, which triggers a re-render.
8. The component maps over `ROWS` and displays each value in the table.

**CORS** — The backend only allows requests from `http://localhost:5173` (the Vite dev server). This is configured in `server/main.py`:

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["GET"],
)
```

If the frontend were hosted elsewhere (e.g. in production), that origin would need to be added here.
