import { lazy, Suspense, useEffect, useState } from "react";

const LazyMap = lazy(() => import("../features/map/MapView"));

export default function MapView() {
    const [isClient, setIsClient] = useState(false);

    useEffect(() => {
        setIsClient(true);
    }, []);

    if (!isClient) {
        return <div>Loading map...</div>;
    }

    return (
        <Suspense fallback={<div>Loading map...</div>}>
            <LazyMap />
        </Suspense>
    );
}
