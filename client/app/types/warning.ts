export interface Warning {
  source: string; // "eva1", "eva2", "rover"
  field: string;
  value: number;
  min: number | null;
  max: number | null;
  nominal: number | null;
  out_of_range: boolean;
  off_nominal: boolean; // in range but deviating from nominal
  reason: string; // optional field to provide additional context or explanation for the warning (AIA)
}
