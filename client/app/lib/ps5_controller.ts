// Utility for reading PS5 DualSense gamepad state via the Web Gamepad API.

export interface PS5State {
  throttle: number; // -100 to 100
  steering: number; // -1.0 to 1.0
  brakes: number; // 0.0 to 1.0 (L2 analog trigger)
  connected: boolean;
}

const AXIS_LEFT_Y = 1; // Left stick vertical → throttle
const AXIS_RIGHT_X = 2; // Right stick horizontal → steering
const BUTTON_L2 = 6; // L2 trigger → brakes

// Ignore axis input below this threshold to prevent stick drift.
const DEADZONE = 0.08;

// After applying the deadzone, rescale so the output spans the full [0, 1] range.
function applyDeadzone(raw: number): number {
  if (Math.abs(raw) < DEADZONE) return 0;
  const scaled = (Math.abs(raw) - DEADZONE) / (1 - DEADZONE);
  return Math.sign(raw) * scaled;
}

// Returns the current control state from the first connected gamepad.
// Returns a safe default (brakes on, no movement) when no gamepad is found.
export function readPS5State(): PS5State {
  const gamepads = navigator.getGamepads();
  const gamepad = gamepads.find((gp) => gp !== null && gp.connected) ?? null;

  if (!gamepad) {
    return { throttle: 0, steering: 0, brakes: 1.0, connected: false };
  }

  // Read raw hardware values
  const rawSteerAxis = gamepad.axes[AXIS_RIGHT_X] ?? 0;
  const rawThrottleAxis = gamepad.axes[AXIS_LEFT_Y] ?? 0;
  const l2Value = gamepad.buttons[BUTTON_L2]?.value ?? 0;

  // Left stick Y is inverted: pushing up gives a negative value, so negate it.
  const throttle = Math.round(applyDeadzone(-rawThrottleAxis) * 100);
  const steering = parseFloat(applyDeadzone(rawSteerAxis).toFixed(2));
  const brakes = parseFloat(l2Value.toFixed(2));

  return { throttle, steering, brakes, connected: true };
}
