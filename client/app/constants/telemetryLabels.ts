export const TELEMETRY_LABELS: Record<string, string> = {
    // --- EVA (shared between EVA1 and EVA2) ---
    primary_battery_level: "Primary Battery",
    secondary_battery_level: "Secondary Battery",
    battery_level: "Battery Level",
    oxy_pri_storage: "Primary O2 Storage",
    oxy_sec_storage: "Secondary O2 Storage",
    oxy_pri_pressure: "Primary O2 Pressure",
    oxy_sec_pressure: "Secondary O2 Pressure",
    suit_pressure_oxy: "O2 Suit Pressure",
    suit_pressure_co2: "CO2 Suit Pressure",
    suit_pressure_other: "Other Suit Pressure",
    suit_pressure_total: "Total Suit Pressure",
    helmet_pressure_co2: "Helmet CO2 Pressure",
    fan_pri_rpm: "Fan 1",
    fan_sec_rpm: "Fan 2",
    scrubber_a_co2_storage: "CO2 Scrubber A",
    scrubber_b_co2_storage: "CO2 Scrubber B",
    temperature: "Body Temperature",
    coolant_storage: "Coolant Storage",
    coolant_gas_pressure: "Coolant Gas Pressure",
    coolant_liquid_pressure: "Coolant Liquid Pressure",
    heart_rate: "Heart Rate",
    oxy_consumption: "O2 Consumption",
    co2_production: "CO2 Production",
    eva_elapsed_time: "EVA Elapsed Time",

    // --- Rover (PrTelemetry) ---
    oxygen_storage: "Oxygen Storage",
    oxygen_pressure: "O2 Pressure",
    oxygen_tank: "Oxygen Tank",
    cabin_pressure: "Cabin Pressure",
    cabin_temperature: "Cabin Temperature",
    cabin_temperature_target: "Target Cabin Temperature",
    external_temp: "External Temperature",
    coolant_pressure: "Coolant Pressure",
    cabin_heating: "Cabin Heating",
    cabin_cooling: "Cabin Cooling",
    lights_on: "Lights",
    brakes: "Brakes",
    throttle: "Throttle",
    steering: "Steering",
    rover_pos_x: "Rover X Position",
    rover_pos_y: "Rover Y Position",
    rover_pos_z: "Rover Z Position",
    heading: "Heading",
    pitch: "Pitch",
    roll: "Roll",
    distance_traveled: "Distance Traveled",
    distance_from_base: "Distance from Base",
    speed: "Speed",
    sunlight: "Sunlight",
    surface_incline: "Surface Incline",
    sim_running: "Simulation Running",
    dust_connected: "Dust Connected",
    rover_elapsed_time: "Rover Elapsed Time",
};

export function getTelemetryLabel(field: string): string {
    if (!field) return "";
    return (
        TELEMETRY_LABELS[field] ??
        field // fallback
            .split("_")
            .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
            .join(" ")
    );
}
