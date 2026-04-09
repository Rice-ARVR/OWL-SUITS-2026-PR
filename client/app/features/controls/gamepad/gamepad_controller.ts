// Utility for reading gamepad state via the Web Gamepad API standard mapping.

export interface GamepadState {
  throttle: number; // -100 to 100
  steering: number; // -1.0 to 1.0
  brakes: number; // 0.0 to 1.0 (left trigger analog value)
  connected: boolean;
  hardwareError: string | null; // null if no fault detected
}

// Standard gamepad API mapping indices: https://w3c.github.io/gamepad/#remapping
const AXIS_LEFT_Y = 1;          // Left stick vertical → throttle
const AXIS_RIGHT_X = 2;         // Right stick horizontal → steering
const BUTTON_LEFT_TRIGGER = 6;  // Left trigger → brakes

// Ignore axis input below this threshold to prevent stick drift.
const DEADZONE = 0.08;

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
    return { throttle: 0, steering: 0, brakes: 1.0, connected: false, hardwareError: null };
  }

  const hardwareError = validateGamepad(gamepad);

  // Read raw hardware values
  const rawSteerAxis = gamepad.axes[AXIS_RIGHT_X] ?? 0;
  const rawThrottleAxis = gamepad.axes[AXIS_LEFT_Y] ?? 0;
  const leftTriggerValue = gamepad.buttons[BUTTON_LEFT_TRIGGER]?.value ?? 0;

  // Left stick Y is inverted: pushing up gives a negative value, so negate it.
  const throttle = Math.round(applyDeadzone(-rawThrottleAxis) * 100);
  const steering = parseFloat(applyDeadzone(rawSteerAxis).toFixed(2));
  const brakes = parseFloat(leftTriggerValue.toFixed(2));

  return { throttle, steering, brakes, connected: true, hardwareError };
}
