// Shared telemetry display and safe operating limits.
// safeMin/safeMax define safe operating limits. These are the same as the limits defined in the NominalRanges in backend. These should be used for mission-critical limit logic!
// min/max define define the min/max for gauge/bars in the frontend. This is purely visual to define the scale for gauges/bars!

export interface TelemetryLimits {
    min: number;
    max: number;
    safeMin: number;
    safeMax: number;
}

export const EVA_LIMITS = {
    // Health
    temperature: { min: 0, max: 40, safeMin: 10, safeMax: 32 },
    heart_rate: { min: 40, max: 180, safeMin: 50, safeMax: 160 },
    // Suit pressure
    suit_pressure_oxy: { min: 0, max: 5.0, safeMin: 3.5, safeMax: 4.1 },
    suit_pressure_co2: { min: 0, max: 0.2, safeMin: 0.0, safeMax: 0.1 },
    suit_pressure_other: { min: 0, max: 1.0, safeMin: 0.0, safeMax: 0.5 },
    suit_pressure_total: { min: 0, max: 5.0, safeMin: 3.5, safeMax: 4.5 },
    helmet_pressure_co2: { min: 0, max: 0.3, safeMin: 0.0, safeMax: 0.15 },
    // CO2
    co2_production: { min: 0, max: 0.2, safeMin: 0.05, safeMax: 0.15 },
    scrubber_a_co2_storage: { min: 0, max: 100, safeMin: 0, safeMax: 60 },
    scrubber_b_co2_storage: { min: 0, max: 100, safeMin: 0, safeMax: 60 },
    // Oxygen
    oxy_pri_storage: { min: 0, max: 100, safeMin: 20, safeMax: 100 },
    oxy_sec_storage: { min: 0, max: 100, safeMin: 20, safeMax: 100 },
    oxy_pri_pressure: { min: 0, max: 3000, safeMin: 600, safeMax: 3000 },
    oxy_sec_pressure: { min: 0, max: 3000, safeMin: 600, safeMax: 3000 },
    // Battery
    primary_battery_level: { min: 0, max: 100, safeMin: 20, safeMax: 100 },
    secondary_battery_level: { min: 0, max: 100, safeMin: 20, safeMax: 100 },
    // Fans
    fan_pri_rpm: { min: 0, max: 30000, safeMin: 20000, safeMax: 30000 },
    fan_sec_rpm: { min: 0, max: 30000, safeMin: 20000, safeMax: 30000 },
    // Coolant
    coolant_storage: { min: 0, max: 100, safeMin: 80, safeMax: 100 },
    coolant_gas_pressure: { min: 0, max: 700, safeMin: 0, safeMax: 700 },
    coolant_liquid_pressure: { min: 0, max: 700, safeMin: 100, safeMax: 700 },
} satisfies Record<string, TelemetryLimits>;

export const ROVER_LIMITS = {
    cabin_temperature: { min: 0, max: 30, safeMin: 10, safeMax: 21 },
    oxygen_storage: { min: 0, max: 100, safeMin: 25, safeMax: 100 },
    oxygen_pressure: { min: 2995, max: 3000, safeMin: 2997, safeMax: 3000 },
    cabin_pressure: { min: 3.0, max: 5.0, safeMin: 3.5, safeMax: 4.1 },
    coolant_pressure: { min: 490, max: 510, safeMin: 495, safeMax: 501 },
    coolant_storage: { min: 0, max: 100, safeMin: 80, safeMax: 100 },
    battery_level: { min: 0, max: 100, safeMin: 30, safeMax: 100 },
    fan_pri_rpm: { min: 29990, max: 30010, safeMin: 29999, safeMax: 30005 },
    fan_sec_rpm: { min: 29990, max: 30010, safeMin: 29999, safeMax: 30005 },
} satisfies Record<string, TelemetryLimits>;
