import { lazy, Suspense } from "react";

const MapView = lazy(() => import("~/routes/MapView"));

export default function MapPage() {
  return (
    <Suspense fallback={<div>Loading map...</div>}>
      <MapView />
    </Suspense>
  );
}
