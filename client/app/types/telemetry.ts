// --- EVA ---

export interface Eva1Telemetry {
    primary_battery_level: number;
    secondary_battery_level: number;
    oxy_pri_storage: number;
    oxy_sec_storage: number;
    oxy_pri_pressure: number;
    oxy_sec_pressure: number;
    suit_pressure_oxy: number;
    suit_pressure_co2: number;
    suit_pressure_other: number;
    suit_pressure_total: number;
    helmet_pressure_co2: number;
    fan_pri_rpm: number;
    fan_sec_rpm: number;
    scrubber_a_co2_storage: number;
    scrubber_b_co2_storage: number;
    temperature: number;
    coolant_storage: number;
    coolant_gas_pressure: number;
    coolant_liquid_pressure: number;
    heart_rate: number;
    oxy_consumption: number;
    co2_production: number;
    eva_elapsed_time: number;
}

export interface Eva2Telemetry {
    battery_level: number;
    oxy_pri_storage: number;
    oxy_sec_storage: number;
    oxy_pri_pressure: number;
    oxy_sec_pressure: number;
    suit_pressure_oxy: number;
    suit_pressure_co2: number;
    suit_pressure_other: number;
    suit_pressure_total: number;
    helmet_pressure_co2: number;
    fan_pri_rpm: number;
    fan_sec_rpm: number;
    scrubber_a_co2_storage: number;
    scrubber_b_co2_storage: number;
    temperature: number;
    coolant_storage: number;
    coolant_gas_pressure: number;
    coolant_liquid_pressure: number;
    heart_rate: number;
    oxy_consumption: number;
    co2_production: number;
    eva_elapsed_time: number;
}

export interface EvaTelemetryBlock {
    eva1: Eva1Telemetry;
    eva2: Eva2Telemetry;
}

export interface EvaStatus {
    started: boolean;
}

export interface Eva1Battery {
    lu: boolean;
    ps: boolean;
}

export interface DcuEva1 {
    oxy: boolean;
    fan: boolean;
    pump: boolean;
    co2: boolean;
    batt: Eva1Battery;
}

export interface DcuEva2 {
    batt: boolean;
    oxy: boolean;
    comm: boolean;
    fan: boolean;
    pump: boolean;
    co2: boolean;
}

export interface Dcu {
    eva1: DcuEva1;
    eva2: DcuEva2;
}

export interface EvaError {
    fan_error: boolean;
    oxy_error: boolean;
    power_error: boolean;
    scrubber_error: boolean;
}

export interface ImuUnit {
    posx: number;
    posy: number;
    heading: number;
}

export interface Imu {
    eva1: ImuUnit;
    eva2: ImuUnit;
}

export interface Uia {
    eva1_power: boolean;
    eva1_oxy: boolean;
    eva1_water_supply: boolean;
    eva1_water_waste: boolean;
    eva2_power: boolean;
    eva2_oxy: boolean;
    eva2_water_supply: boolean;
    eva2_water_waste: boolean;
    oxy_vent: boolean;
    depress: boolean;
}

export interface EvaSnapshot {
    telemetry: EvaTelemetryBlock;
    status: EvaStatus;
    dcu: Dcu;
    error: EvaError;
    imu: Imu;
    uia: Uia;
}

// --- Rover ---

export interface PrTelemetry {
    cabin_heating: boolean;
    cabin_cooling: boolean;
    lights_on: boolean;
    brakes: boolean;
    throttle: number;
    steering: number;
    rover_pos_x: number;
    rover_pos_y: number;
    rover_pos_z: number;
    heading: number;
    pitch: number;
    roll: number;
    distance_traveled: number;
    speed: number;
    sunlight: number;
    surface_incline: number;
    lidar: number[];
    oxygen_storage: number;
    oxygen_pressure: number;
    cabin_pressure: number;
    cabin_temperature: number;
    external_temp: number;
    coolant_pressure: number;
    coolant_storage: number;
    primary_battery_level: number;
    secondary_battery_level: number;
    rover_elapsed_time: number;
    sim_running: boolean;
    dust_connected: boolean;
    distance_from_base: number;
    oxygen_tank: number;
    battery_level: number;
    fan_pri_rpm: number;
    fan_sec_rpm: number;
    scrubber_a_co2_storage: number;
    scrubber_b_co2_storage: number;
    cabin_temperature_target: number;
}

export interface RoverSnapshot {
    pr_telemetry: PrTelemetry;
}

// --- LTV ---

export interface LtvLocation {
    last_known_x: number;
    last_known_y: number;
}

export interface LtvSignal {
    strength: number;
    ping_requested: number;
    ping_unlimited_requested: number;
}

export interface LtvSnapshot {
    location: LtvLocation;
    signal: LtvSignal;
}

// --- LTV Errors ---

export interface ErrorProcedure {
    code: string;
    description: string;
    needs_resolved: boolean;
    procedures: string[];
}

export interface LtvErrorsSnapshot {
    error_procedures: ErrorProcedure[];
}

// --- Full snapshot (shape of each WS message) ---

export interface TelemetrySnapshot {
    eva: EvaSnapshot;
    rover: RoverSnapshot;
    ltv: LtvSnapshot;
    ltv_errors: LtvErrorsSnapshot;
}
