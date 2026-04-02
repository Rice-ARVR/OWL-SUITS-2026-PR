import { useEffect, useState } from "react";

import styles from "./telemetry.module.css";

interface TelemetryData {
  cabin_temperature: number;
  outside_temperature: number;
  oxygen_storage: number;
  battery_level: number;
  cabin_pressure: number;
  o2_pressure: number;
  coolant_storage: number;
  coolant_pressure: number;
  fan1_rpm: number;
  fan2_rpm: number;
}
