// src/modules/mqtt/services/sensor-matcher.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { Sensor } from '../../../entities/sensor.entity';
import { ParsedValue, SensorMessageParserService } from './sensor-message-parser.service';

export interface SensorValueMatch {
  sensor: Sensor;
  value: number;
  matchType: 'exact_unit' | 'normalized_unit' | 'type_based';
}

@Injectable()
export class SensorMatcherService {
  private readonly logger = new Logger(SensorMatcherService.name);

  constructor(private messageParser: SensorMessageParserService) {}

  /**
   * Match parsed values to sensors and return all matches
   */
  matchSensorsToValues(sensors: Sensor[], parsedValues: ParsedValue[]): SensorValueMatch[] {
    const matches: SensorValueMatch[] = [];

    for (const sensor of sensors) {
      const matchingValue = this.findMatchingValue(sensor, parsedValues);
      if (matchingValue) {
        matches.push({
          sensor,
          value: matchingValue.value,
          matchType: matchingValue.matchType
        });
      }
    }

    this.logger.log(`🔍 Found ${matches.length} sensor-value matches out of ${sensors.length} sensors`);
    return matches;
  }

  /**
   * Find the value that matches this sensor's unit
   */
  private findMatchingValue(sensor: Sensor, parsedValues: ParsedValue[]): { value: number; matchType: SensorValueMatch['matchType'] } | null {
    // 1. Direct unit match (highest priority)
    const exactMatch = parsedValues.find(pv => pv.unit === sensor.unit);
    if (exactMatch) {
      return { value: exactMatch.value, matchType: 'exact_unit' };
    }

    // 2. Normalized unit match (handle encoding issues)
    const normalizedSensorUnit = this.messageParser.normalizeUnit(sensor.unit);
    const unitMatch = parsedValues.find(pv => 
      this.messageParser.normalizeUnit(pv.unit) === normalizedSensorUnit
    );
    if (unitMatch) {
      return { value: unitMatch.value, matchType: 'normalized_unit' };
    }

    // 3. Fallback: match by sensor type patterns (lowest priority)
    const typeBasedMatch = parsedValues.find(pv => this.matchesSensorType(sensor, pv));
    if (typeBasedMatch) {
      return { value: typeBasedMatch.value, matchType: 'type_based' };
    }

    return null;
  }

  /**
   * Check if a parsed value matches a sensor type
   */
  private matchesSensorType(sensor: Sensor, parsedValue: ParsedValue): boolean {
    const sensorType = sensor.type.toLowerCase();
    const unit = parsedValue.unit.toLowerCase();

    // Temperature sensors
    if (sensorType.includes('temp')) {
      return this.isTemperatureUnit(unit);
    }
    
    // Humidity sensors
    if (sensorType.includes('humid')) {
      return this.isHumidityUnit(unit);
    }
    
    // Soil moisture sensors
    if (sensorType.includes('soil')) {
      return this.isMoistureUnit(unit);
    }
    
    // Light sensors
    if (sensorType.includes('light')) {
      return this.isLightUnit(unit);
    }

    // pH sensors
    if (sensorType.includes('ph')) {
      return this.isPHUnit(unit);
    }

    // Pressure sensors
    if (sensorType.includes('pressure')) {
      return this.isPressureUnit(unit);
    }

    return false;
  }

  /**
   * Unit type checking methods
   */
  private isTemperatureUnit(unit: string): boolean {
    return unit.includes('°c') || unit.includes('�c') || unit.includes('c') || 
           unit.includes('°f') || unit.includes('celsius') || unit.includes('fahrenheit') ||
           unit.includes('temp');
  }

  private isHumidityUnit(unit: string): boolean {
    return unit.includes('%') || unit.includes('humidity') || unit.includes('humid');
  }

  private isMoistureUnit(unit: string): boolean {
    return unit.includes('%') || unit.includes('moisture');
  }

  private isLightUnit(unit: string): boolean {
    return unit.includes('lux') || unit.includes('lumen') || unit.includes('light');
  }

  private isPHUnit(unit: string): boolean {
    return unit.includes('ph') || unit === '';
  }

  private isPressureUnit(unit: string): boolean {
    return unit.includes('pa') || unit.includes('bar') || unit.includes('psi') || 
           unit.includes('pressure');
  }

  /**
   * Get detailed matching information for debugging
   */
  getMatchingDetails(sensors: Sensor[], parsedValues: ParsedValue[]): any {
    return {
      sensors: sensors.map(s => ({ id: s.sensor_id, type: s.type, unit: s.unit })),
      parsedValues: parsedValues,
      matches: this.matchSensorsToValues(sensors, parsedValues).map(m => ({
        sensorId: m.sensor.sensor_id,
        sensorType: m.sensor.type,
        sensorUnit: m.sensor.unit,
        matchedValue: m.value,
        matchType: m.matchType
      }))
    };
  }
}