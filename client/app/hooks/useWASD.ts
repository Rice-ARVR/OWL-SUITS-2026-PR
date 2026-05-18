import { useEffect, useRef, useState } from "react";

import { controllerManager } from "~/lib/controllerManager";

const THROTTLE_STEP = 10; // out of 100
const STEERING_STEP = 0.1; // out of 1.0
const HOLD_INTERVAL_MS = 100;

const ANALOG_KEYS = ["w", "a", "s", "d"];
const TOGGLE_KEYS = [" ", "q", "e", "r"];

export interface WASDHookState {
    throttle: number;
    steering: number;
    brakes: number;
    cabinHeating: number;
    cabinCooling: number;
    headlights: number;
}

export function useWASD(): WASDHookState {
    const [throttle, setThrottle] = useState(0);
    const [steering, setSteering] = useState(0);
    const [brakes, setBrakes] = useState(1.0);
    const [cabinHeating, setCabinHeating] = useState(0);
    const [cabinCooling, setCabinCooling] = useState(0);
    const [headlights, setHeadlights] = useState(0);

    const throttleRef = useRef(0);
    const steeringRef = useRef(0);
    const brakesRef = useRef(1.0);
    const cabinHeatingRef = useRef(0);
    const cabinCoolingRef = useRef(0);
    const headlightsRef = useRef(0);
    const pressedKeys = useRef<Set<string>>(new Set());
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    useEffect(() => {
        controllerManager.registerInitialSync({
            throttle: 0, steering: 0, brakes: 1.0,
            cabin_heating: 0, cabin_cooling: 0, headlights: 0,
        });
        controllerManager.connect();

        const stopInterval = () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
        };

        const applyKeys = () => {
            let t = throttleRef.current;
            let s = steeringRef.current;

            // Throttle: ramp up while W held, ramp down while S held, return to 0 on release.
            if (pressedKeys.current.has("w")) {
                t = Math.min(100, t + THROTTLE_STEP);
            } else if (pressedKeys.current.has("s")) {
                t = Math.max(-100, t - THROTTLE_STEP);
            } else if (t > 0) {
                t = Math.max(0, t - THROTTLE_STEP);
            } else if (t < 0) {
                t = Math.min(0, t + THROTTLE_STEP);
            }

            // Steering: ramp right while D held, ramp left while A held, return to 0 on release.
            if (pressedKeys.current.has("d")) {
                s = Math.min(1.0, parseFloat((s + STEERING_STEP).toFixed(2)));
            } else if (pressedKeys.current.has("a")) {
                s = Math.max(-1.0, parseFloat((s - STEERING_STEP).toFixed(2)));
            } else if (s > 0) {
                s = Math.max(0, parseFloat((s - STEERING_STEP).toFixed(2)));
            } else if (s < 0) {
                s = Math.min(0, parseFloat((s + STEERING_STEP).toFixed(2)));
            }

            const throttleChanged = t !== throttleRef.current;
            const steeringChanged = s !== steeringRef.current;

            if (throttleChanged || steeringChanged) {
                throttleRef.current = t;
                steeringRef.current = s;
                setThrottle(t);
                setSteering(s);

                const payload: { throttle?: number; steering?: number } = {};
                if (throttleChanged) payload.throttle = t;
                if (steeringChanged) payload.steering = s;
                controllerManager.sendCommand(payload);
            }

            // Once all keys are released and values have wound back to zero, stop the interval.
            if (pressedKeys.current.size === 0 && t === 0 && s === 0) {
                stopInterval();
            }
        };

        const startInterval = () => {
            if (!intervalRef.current) {
                intervalRef.current = setInterval(applyKeys, HOLD_INTERVAL_MS);
            }
        };

        const handleKeyDown = (e: KeyboardEvent) => {
            const tag = (e.target as HTMLElement).tagName;
            if (tag === "INPUT" || tag === "TEXTAREA") return;
            const key = e.key === " " ? " " : e.key.toLowerCase();
            if (![...ANALOG_KEYS, ...TOGGLE_KEYS].includes(key)) return;
            e.preventDefault();

            if (TOGGLE_KEYS.includes(key)) {
                if (e.repeat) return;
                if (key === " ") {
                    const next = brakesRef.current === 1.0 ? 0.0 : 1.0;
                    brakesRef.current = next;
                    setBrakes(next);
                    controllerManager.sendCommand({ brakes: next });
                } else if (key === "q") {
                    const next = headlightsRef.current === 1.0 ? 0.0 : 1.0;
                    headlightsRef.current = next;
                    setHeadlights(next);
                    controllerManager.sendCommand({ headlights: next });
                } else if (key === "e") {
                    const next = cabinCoolingRef.current === 1.0 ? 0.0 : 1.0;
                    cabinCoolingRef.current = next;
                    setCabinCooling(next);
                    controllerManager.sendCommand({ cabin_cooling: next });
                } else if (key === "r") {
                    const next = cabinHeatingRef.current === 1.0 ? 0.0 : 1.0;
                    cabinHeatingRef.current = next;
                    setCabinHeating(next);
                    controllerManager.sendCommand({ cabin_heating: next });
                }
                return;
            }

            if (e.repeat) return;
            pressedKeys.current.add(key);
            applyKeys();    // immediate response on first press
            startInterval(); // then repeat at interval while held
        };

        const handleKeyUp = (e: KeyboardEvent) => {
            const tag = (e.target as HTMLElement).tagName;
            if (tag === "INPUT" || tag === "TEXTAREA") return;
            const key = e.key === " " ? " " : e.key.toLowerCase();
            pressedKeys.current.delete(key);
            // Don't stop the interval here — let applyKeys wind values back to 0 first.
        };

        window.addEventListener("keydown", handleKeyDown);
        window.addEventListener("keyup", handleKeyUp);

        return () => {
            window.removeEventListener("keydown", handleKeyDown);
            window.removeEventListener("keyup", handleKeyUp);
            stopInterval();
        };
    }, []);

    return { throttle, steering, brakes, cabinHeating, cabinCooling, headlights };
}