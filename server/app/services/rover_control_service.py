import app.services.telemetry.tss_client as tss_client


async def send_rover_command(payload: dict) -> None:
    # Send individual control commands based on provided fields
    if 'brakes' in payload:
        tss_client.send_brakes(float(payload['brakes']))
    if 'throttle' in payload:
        tss_client.send_throttle(float(payload['throttle']))
    if 'steering' in payload:
        tss_client.send_steering(float(payload['steering']))
