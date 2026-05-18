import { useEffect, useReducer } from "react";

import { navigationTelemetryManager } from "~/lib/navigationTelemetryManager";

export function useNavigationTelemetry() {
    const [, forceUpdate] = useReducer((x: number) => x + 1, 0);

    useEffect(() => {
        navigationTelemetryManager.connect();
        const unsubscribe = navigationTelemetryManager.subscribe(forceUpdate);
        return unsubscribe;
    }, []);

    return navigationTelemetryManager;
}
