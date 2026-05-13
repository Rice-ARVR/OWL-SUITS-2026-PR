import { useEffect, useReducer } from "react";

import { telemetryManager } from "~/lib/telemetryManager";

export function useTelemetry() {
    const [, forceUpdate] = useReducer((x: number) => x + 1, 0);

    useEffect(() => {
        telemetryManager.connect();
        const unsubscribe = telemetryManager.subscribe(forceUpdate);
        return unsubscribe;
    }, []);

    return telemetryManager;
}
