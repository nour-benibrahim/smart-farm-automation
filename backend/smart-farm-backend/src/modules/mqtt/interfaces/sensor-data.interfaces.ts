// src/modules/mqtt/interfaces/sensor-data.interfaces.ts

export interface ParsedValue {
  value: number;
  unit: string;
  raw: string;
}

export interface SensorValueMatch {
  sensor: any; // Replace with proper Sensor type
  value: number;
  matchType: 'exact_unit' | 'normalized_unit' | 'type_based';
}

export interface ThresholdViolation {
  sensor: any; // Replace with proper Sensor type
  value: number;
  violationType: 'critical_low' | 'warning_low' | 'critical_high' | 'warning_high';
  action?: string;
  timestamp: Date;
}

export interface ThresholdCheckResult {
  isWithinLimits: boolean;
  violations: ThresholdViolation[];
  status: 'normal' | 'warning' | 'critical';
}

export interface ActionContext {
  sensorId: string;
  sensorType: string;
  deviceId: string;
  value: number;
  unit: string;
  violationType?: string;
  timestamp: Date;
}

export interface ActionResult {
  success: boolean;
  action: string;
  context: ActionContext;
  executedAt: Date;
  error?: string;
}

// Event payload interfaces
export interface SensorReadingEvent {
  sensorId: string;
  deviceId: string;
  value: number;
  unit: string;
  timestamp: Date;
}

export interface ThresholdViolationEvent extends ThresholdViolation {
  deviceId: string;
}

export interface ActionExecutionEvent extends ActionResult {
  triggeredBy: 'threshold' | 'manual' | 'schedule';
}