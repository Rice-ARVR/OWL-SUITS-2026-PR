# Frontend Structure

This project uses **React Router v7** (framework mode) with **Tailwind CSS** and a feature-based folder organization.

## Folder Structure

```
client/
├── public/                             # Static files served as-is (favicon, etc.)
│
├── app/
│   ├── root.tsx                        # App shell, global providers, error boundary
│   ├── routes.ts                       # Route definitions
│   ├── app.css                         # Tailwind imports + CSS custom properties
│   │
│   ├── routes/                         # Thin route modules
│   │   ├── map.tsx
│   │   ├── navigation.tsx
│   │   └── task-board.tsx
│   │
│   ├── features/                       # One folder per monitor/route
│   │   ├── map/
│   │   │   ├── MapView.tsx
│   │   │   ├── MapCanvas.tsx
│   │   │   ├── MapControls.tsx
│   │   │   ├── MapOverlay.tsx
│   │   │   └── hooks/
│   │   │       └── useMapData.ts
│   │   │
│   │   ├── navigation/
│   │   │   ├── NavigationView.tsx
│   │   │   ├── RoutePanel.tsx
│   │   │   ├── DirectionsList.tsx
│   │   │   └── hooks/
│   │   │       └── useNavigation.ts
│   │   │
│   │   └── task-board/
│   │       ├── TaskBoardView.tsx
│   │       ├── TaskColumn.tsx
│   │       ├── TaskCard.tsx
│   │       └── hooks/
│   │           └── useTasks.ts
│   │
│   ├── components/                     # Shared UI — only used across 2+ features
│   │   └── ui/                         # Primitive components (Button, Badge, Modal)
│   │
│   ├── lib/                            # Pure TypeScript — no JSX, no hooks
│   │   ├── api.ts                      # API client / fetch wrappers
│   │   └── utils.ts                    # Formatters, constants, helpers
│   │
│   └── types/                          # Shared TypeScript interfaces
│       └── index.ts
│
├── react-router.config.ts
├── vite.config.ts
├── tailwind.config.ts
├── tsconfig.json
└── package.json
```

## Key Conventions

### Routes are thin

Route files in `routes/` handle only data loading (`loader`) and actions (`action`), then hand off rendering to the matching feature view:

```tsx
// routes/map.tsx
import { MapView } from "~/features/map/MapView";

export async function loader() {
  return {
    /* map data */
  };
}

export default function MapRoute() {
  return <MapView />;
}
```

### Features are self-contained

This app runs across three monitors, each mapped to a route. Because each monitor's components are only relevant to that monitor, all component files, subcomponents, and hooks live inside their respective feature folder. Do not move something to `components/` unless a second feature needs it.

### Promotion rule

Start co-located inside a feature. Promote to `components/` only when genuinely shared across two or more features.

```
# Wrong — premature sharing
components/
└── MapMarker.tsx        # only used by map

# Right — co-located
features/map/
└── MapMarker.tsx
```

### Feature-specific types stay in the feature

Only types shared across multiple features belong in `types/index.ts`. Types like `TaskCard` props or internal map state stay inside their feature folder.

### `lib/` is framework-free

No JSX, no React hooks. Pure TypeScript utilities only — API clients, date formatters, the `cn()` Tailwind helper, etc.

## Styling

CSS Modules are used for component-level styling. Each component has a co-located `.module.css` file:

```
features/map/
├── MapView.tsx
├── MapView.module.css
├── MapControls.tsx
└── MapControls.module.css
```

```tsx
import styles from "./MapView.module.css";

<div className={styles.container}>
```

Global CSS custom properties (colors, spacing tokens) are defined in `app.css` and consumed inside module files:

```css
/* app.css */
:root {
  --color-primary: #3b82f6;
  --panel-bg: #1a1a2e;
}
```

```css
/* MapView.module.css */
.container {
  background: var(--panel-bg);
}
```
