import { useEffect, useRef, useState } from "react";

import {
    readGamepadState,
    type GamepadState,
} from "~/features/controls/gamepad/gamepad_controller";
import { controllerManager } from "~/lib/controllerManager";

const SEND_INTERVAL_MS = 50;
const THROTTLE_THRESHOLD = 1; // out of 100
const STEERING_THRESHOLD = 0.01; // out of 1.0
const BRAKES_THRESHOLD = 0.01; // out of 1.0

const DISCONNECTED_STATE: GamepadState = {
    throttle: 0,
    steering: 0,
    brakes: 1.0,
    cabinHeating: 0,
    cabinCooling: 0,
    headlights: 0,
    connected: false,
    hardwareError: null,
};

export interface GamepadHookState {
    throttle: number;
    steering: number;
    brakes: number;
    cabinHeating: number;
    cabinCooling: number;
    headlights: number;
    connected: boolean;
    hardwareError: string | null;
}

export function useGamepad(): GamepadHookState {
    const [throttle, setThrottle] = useState(0);
    const [steering, setSteering] = useState(0);
    const [brakes, setBrakes] = useState(1.0);
    const [cabinHeating, setCabinHeating] = useState(0);
    const [cabinCooling, setCabinCooling] = useState(0);
    const [headlights, setHeadlights] = useState(0);
    const [connected, setConnected] = useState(false);
    const [hardwareError, setHardwareError] = useState<string | null>(null);

    const prevSentRef = useRef<GamepadState>(DISCONNECTED_STATE);
    const lastSendTimeRef = useRef<number>(0);
    const rafRef = useRef<number | null>(null);
    const prevHardwareErrorRef = useRef<string | null>(null);

    useEffect(() => {
        controllerManager.registerInitialSync({
            throttle: 0,
            steering: 0,
            brakes: 1.0,
            cabin_heating: 0,
            cabin_cooling: 0,
            headlights: 0,
        });
        controllerManager.connect();

        const poll = (timestamp: number) => {
            const state = readGamepadState();
            const prev = prevSentRef.current;

            setConnected(state.connected);

            if (state.connected) {
                if (!prev.connected) {
                    console.log("Controller connected");
                }

                if (state.hardwareError !== prevHardwareErrorRef.current) {
                    if (state.hardwareError !== null) {
                        console.error("Controller hardware fault:", state.hardwareError);
                    } else {
                        console.log("Controller hardware fault cleared");
                    }
                    prevHardwareErrorRef.current = state.hardwareError;
                    setHardwareError(state.hardwareError);
                }

                const throttleChanged =
                    Math.abs(state.throttle - prev.throttle) >= THROTTLE_THRESHOLD;
                const steeringChanged =
                    Math.abs(state.steering - prev.steering) >= STEERING_THRESHOLD;
                const brakesChanged = Math.abs(state.brakes - prev.brakes) >= BRAKES_THRESHOLD;
                const cabinHeatingChanged = state.cabinHeating !== prev.cabinHeating;
                const cabinCoolingChanged = state.cabinCooling !== prev.cabinCooling;
                const headlightsChanged = state.headlights !== prev.headlights;

                const analogChanged = throttleChanged || steeringChanged || brakesChanged;
                const toggleChanged =
                    cabinHeatingChanged || cabinCoolingChanged || headlightsChanged;
                const rateLimitElapsed = timestamp - lastSendTimeRef.current >= SEND_INTERVAL_MS;

                // Toggles are sent immediately; analog values are rate-limited.
                if (toggleChanged || (analogChanged && rateLimitElapsed)) {
                    prevSentRef.current = state;
                    lastSendTimeRef.current = timestamp;

                    if (analogChanged) {
                        setThrottle(state.throttle);
                        setSteering(state.steering);
                        setBrakes(state.brakes);
                    }
                    if (cabinHeatingChanged) setCabinHeating(state.cabinHeating);
                    if (cabinCoolingChanged) setCabinCooling(state.cabinCooling);
                    if (headlightsChanged) setHeadlights(state.headlights);

                    const payload: Parameters<typeof controllerManager.sendCommand>[0] = {};
                    if (throttleChanged) payload.throttle = state.throttle;
                    if (steeringChanged) payload.steering = state.steering;
                    if (brakesChanged) payload.brakes = state.brakes;
                    if (cabinHeatingChanged) payload.cabin_heating = state.cabinHeating;
                    if (cabinCoolingChanged) payload.cabin_cooling = state.cabinCooling;
                    if (headlightsChanged) payload.headlights = state.headlights;
                    controllerManager.sendCommand(payload);
                }
            } else if (prev.connected) {
                console.log("Controller disconnected");

                prevSentRef.current = { ...DISCONNECTED_STATE };
                setThrottle(0);
                setSteering(0);
                setBrakes(1.0);

                // Apply brakes as a safety measure on disconnect.
                controllerManager.sendCommand({ throttle: 0, steering: 0, brakes: 1.0 });
            }

            rafRef.current = requestAnimationFrame(poll);
        };

        rafRef.current = requestAnimationFrame(poll);

        return () => {
            if (rafRef.current !== null) {
                cancelAnimationFrame(rafRef.current);
            }
        };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    return {
        throttle,
        steering,
        brakes,
        cabinHeating,
        cabinCooling,
        headlights,
        connected,
        hardwareError,
    };
}
