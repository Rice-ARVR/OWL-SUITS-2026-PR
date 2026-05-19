import asyncio
import logging

import app.services.telemetry.tss_client as tss_client

logger = logging.getLogger(__name__)

# --- Deadzones ---
# Throttle is on a [-100, 100] scale.
# Steering is on a [-1.0, 1.0] scale.
# These prevent tiny physical joystick stick-drifts from accidentally aborting missions!
THROTTLE_DEADZONE = 5.0
STEERING_DEADZONE = 0.05


async def send_rover_command(
    throttle: float, steering: float, apply_brakes: bool = False
) -> None:
    """
    Gatekeeper for manual rover commands.
    Routes commands to the TSS, but acts as an 'Any-Input' Kill Switch if AI is driving.
    """
    # LOCAL IMPORT: We must import this locally inside the function, otherwise
    # Python will throw a Circular Import Error since navigation_service
    # imports this file to use the brakes!
    from app.services.navigation.navigation_service import (
        navigation_state,
        stop_autonomous_loop,
    )

    # 1. Fetch current AI state
    state = await navigation_state.get_snapshot()

    # --- 2. THE "ANY-INPUT" KILL SWITCH ---
    if state.autonomous_driving:
        # Evaluate if this is a genuine human input bypassing the deadzones.
        # (Note: The AI's 4-second pause sends T:0.0, S:0.0, so the AI will not kill itself)
        human_override = (
            abs(throttle) > THROTTLE_DEADZONE or abs(steering) > STEERING_DEADZONE
        )

        if human_override:
            logger.warning(
                f"Manual override detected (Throttle: {throttle:.1f}, Steering: {steering:.2f})! "
                "Detonating AI Kill Switch."
            )
            # This safely updates the NavigationState, drops the AI flag,
            # cancels the background loops, and alerts the UI perfectly.
            await stop_autonomous_loop()

    # --- 3. HARDWARE ROUTING ---
    try:
        # If the user or AI explicitly requested brakes, engage them (1.0). Otherwise, release (0.0).
        brake_val = 1.0 if apply_brakes else 0.0

        # Dispatch concurrently to the TSS network client
        await asyncio.gather(
            asyncio.to_thread(tss_client.send_brakes, float(brake_val)),
            asyncio.to_thread(tss_client.send_steering, float(steering)),
            asyncio.to_thread(tss_client.send_throttle, float(throttle)),
        )

    except Exception as e:
        logger.error(f"Failed to route manual drive command to TSS: {e}")
