import { createContext, useContext, type ReactNode } from "react";

import { useGamepad, type GamepadHookState } from "~/hooks/useGamepad";

const GamepadContext = createContext<GamepadHookState | null>(null);

/**
 * Runs the single app-wide gamepad polling loop and shares its state with
 * every route. Mounted once at the app root so there is exactly one
 * requestAnimationFrame loop and one rover-control WebSocket stream.
 */
export function GamepadProvider({ children }: { children: ReactNode }) {
    const gamepad = useGamepad();
    return <GamepadContext.Provider value={gamepad}>{children}</GamepadContext.Provider>;
}

/**
 * Access the shared gamepad state from any route or screen.
 * Must be used within a <GamepadProvider> (mounted at the app root).
 */
export function useGamepadContext(): GamepadHookState {
    const ctx = useContext(GamepadContext);
    if (ctx === null) {
        throw new Error("useGamepadContext must be used within a <GamepadProvider>");
    }
    return ctx;
}
