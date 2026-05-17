// Utility for reading gamepad state via the Web Gamepad API standard mapping.

export interface GamepadState {
    throttle: number; // -100 to 100
    steering: number; // -1.0 to 1.0
    brakes: number; // 0.0 to 1.0 (max of left/right trigger)
    cabinHeating: number; // 0.0 or 1.0
    cabinCooling: number; // 0.0 or 1.0
    headlights: number; // 0.0 or 1.0
    connected: boolean;
    hardwareError: string | null; // null if no fault detected
}

// Standard gamepad API mapping indices: https://w3c.github.io/gamepad/#remapping
const AXIS_LEFT_Y = 1; // Left stick vertical → throttle
const AXIS_RIGHT_X = 2; // Right stick horizontal → steering
const BUTTON_LEFT_TRIGGER = 6; // Left trigger → brakes
const BUTTON_RIGHT_TRIGGER = 7; // Right trigger → brakes (max with left)
const BUTTON_Y = 3; // Y button → headlights toggle
const BUTTON_DPAD_UP = 12; // DPad up → cabin heating toggle
const BUTTON_DPAD_DOWN = 13; // DPad down → cabin cooling toggle

// Ignore axis input below this threshold to prevent stick drift.
const DEADZONE = 0.08;

// Toggle state — persists across readGamepadState() calls for edge detection.
let cabinHeating = 0;
let cabinCooling = 0;
let headlights = 0;
let prevDpadUp = false;
let prevDpadDown = false;
let prevButtonY = false;

// After applying the deadzone, rescale so the output spans the full [0, 1] range.
function applyDeadzone(raw: number): number {
    if (Math.abs(raw) < DEADZONE) return 0;
    const scaled = (Math.abs(raw) - DEADZONE) / (1 - DEADZONE);
    return Math.sign(raw) * scaled;
}

// Checks for hardware faults: NaN and out-of-range axis/button values.
// Returns a description of the first fault found, or null if everything looks healthy.
function validateGamepad(gamepad: Gamepad): string | null {
    for (let i = 0; i < gamepad.axes.length; i++) {
        const val = gamepad.axes[i];
        if (isNaN(val)) return `Axis ${i} returned NaN`;
        if (val < -1 || val > 1) return `Axis ${i} out of range: ${val.toFixed(3)}`;
    }
    for (let i = 0; i < gamepad.buttons.length; i++) {
        const val = gamepad.buttons[i]?.value;
        if (val === undefined) continue;
        if (isNaN(val)) return `Button ${i} returned NaN`;
        if (val < 0 || val > 1) return `Button ${i} out of range: ${val.toFixed(3)}`;
    }
    return null;
}

// Returns the current control state from the first connected gamepad.
// Returns a safe default (brakes on, no movement) when no gamepad is found.
export function readGamepadState(): GamepadState {
    const gamepads = navigator.getGamepads();
    const gamepad = gamepads.find((gp) => gp !== null && gp.connected) ?? null;

    if (!gamepad) {
        return {
            throttle: 0,
            steering: 0,
            brakes: 1.0,
            cabinHeating,
            cabinCooling,
            headlights,
            connected: false,
            hardwareError: null,
        };
    }

    const hardwareError = validateGamepad(gamepad);

    // Read raw hardware values
    const rawSteerAxis = gamepad.axes[AXIS_RIGHT_X] ?? 0;
    const rawThrottleAxis = gamepad.axes[AXIS_LEFT_Y] ?? 0;
    const leftTriggerValue = gamepad.buttons[BUTTON_LEFT_TRIGGER]?.value ?? 0;
    const rightTriggerValue = gamepad.buttons[BUTTON_RIGHT_TRIGGER]?.value ?? 0;

    const curDpadUp = (gamepad.buttons[BUTTON_DPAD_UP]?.value ?? 0) > 0.5;
    const curDpadDown = (gamepad.buttons[BUTTON_DPAD_DOWN]?.value ?? 0) > 0.5;
    const curButtonY = (gamepad.buttons[BUTTON_Y]?.value ?? 0) > 0.5;

    // Toggle on rising edge only.
    if (curDpadUp && !prevDpadUp) cabinHeating = cabinHeating === 1 ? 0 : 1;
    if (curDpadDown && !prevDpadDown) cabinCooling = cabinCooling === 1 ? 0 : 1;
    if (curButtonY && !prevButtonY) headlights = headlights === 1 ? 0 : 1;

    prevDpadUp = curDpadUp;
    prevDpadDown = curDpadDown;
    prevButtonY = curButtonY;

    // Left stick Y is inverted: pushing up gives a negative value, so negate it.
    const throttle = Math.round(applyDeadzone(-rawThrottleAxis) * 100);
    const steering = parseFloat(applyDeadzone(rawSteerAxis).toFixed(2));
    const brakes = parseFloat(Math.max(leftTriggerValue, rightTriggerValue).toFixed(2));

    return {
        throttle,
        steering,
        brakes,
        cabinHeating,
        cabinCooling,
        headlights,
        connected: true,
        hardwareError,
    };
}
