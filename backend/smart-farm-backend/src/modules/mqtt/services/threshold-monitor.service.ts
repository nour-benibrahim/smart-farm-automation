// src/modules/mqtt/services/threshold-monitor.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Sensor } from '../../../entities/sensor.entity';

export interface ThresholdViolation {
  sensor: Sensor;
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

@Injectable()
export class ThresholdMonitorService {
  private readonly logger = new Logger(ThresholdMonitorService.name);

  constructor(private eventEmitter: EventEmitter2) {}

  /**
   * Check all thresholds for a sensor value
   */
  checkThresholds(sensor: Sensor, value: number): ThresholdCheckResult {
    const violations: ThresholdViolation[] = [];
    let status: ThresholdCheckResult['status'] = 'normal';

    // Check low thresholds
    const lowViolation = this.checkLowThresholds(sensor, value);
    if (lowViolation) {
      violations.push(lowViolation);
      if (lowViolation.violationType === 'critical_low') {
        status = 'critical';
      } else if (status === 'normal') {
        status = 'warning';
      }
    }

    // Check high thresholds
    const highViolation = this.checkHighThresholds(sensor, value);
    if (highViolation) {
      violations.push(highViolation);
      if (highViolation.violationType === 'critical_high') {
        status = 'critical';
      } else if (status === 'normal') {
        status = 'warning';
      }
    }

    // Emit events for violations
    violations.forEach(violation => {
      this.emitThresholdEvent(violation);
      this.logThresholdViolation(violation);
    });

    return {
      isWithinLimits: violations.length === 0,
      violations,
      status
    };
  }

  /**
   * Check low threshold violations
   */
  private checkLowThresholds(sensor: Sensor, value: number): ThresholdViolation | null {
    if (sensor.min_critical !== null && value <= sensor.min_critical) {
      return {
        sensor,
        value,
        violationType: 'critical_low',
        action: sensor.action_low,
        timestamp: new Date()
      };
    }

    if (sensor.min_warning !== null && value <= sensor.min_warning) {
      return {
        sensor,
        value,
        violationType: 'warning_low',
        timestamp: new Date()
      };
    }

    return null;
  }

  /**
   * Check high threshold violations
   */
  private checkHighThresholds(sensor: Sensor, value: number): ThresholdViolation | null {
    if (sensor.max_critical !== null && value >= sensor.max_critical) {
      return {
        sensor,
        value,
        violationType: 'critical_high',
        action: sensor.action_high,
        timestamp: new Date()
      };
    }

    if (sensor.max_warning !== null && value >= sensor.max_warning) {
      return {
        sensor,
        value,
        violationType: 'warning_high',
        timestamp: new Date()
      };
    }

    return null;
  }

  /**
   * Emit threshold violation event
   */
  private emitThresholdEvent(violation: ThresholdViolation) {
    this.eventEmitter.emit('threshold.violation', violation);
    
    // Emit specific events for different violation types
    this.eventEmitter.emit(`threshold.${violation.violationType}`, violation);
    
    // Emit sensor-specific events
    this.eventEmitter.emit(`sensor.${violation.sensor.sensor_id}.threshold`, violation);
  }

  /**
   * Log threshold violation with appropriate level
   */
  private logThresholdViolation(violation: ThresholdViolation) {
    const { sensor, value, violationType } = violation;
    const message = `${this.getViolationEmoji(violationType)} ${this.getViolationText(violationType)} ${sensor.type}: ${value}${sensor.unit}`;
    
    if (violationType.includes('critical')) {
      this.logger.error(message);
    } else {
      this.logger.warn(message);
    }
  }

  /**
   * Get emoji for violation type
   */
  private getViolationEmoji(violationType: ThresholdViolation['violationType']): string {
    switch (violationType) {
      case 'critical_low':
      case 'critical_high':
        return '🚨';
      case 'warning_low':
      case 'warning_high':
        return '⚠️';
      default:
        return '📊';
    }
  }

  /**
   * Get text description for violation type
   */
  private getViolationText(violationType: ThresholdViolation['violationType']): string {
    switch (violationType) {
      case 'critical_low':
        return 'CRITICAL LOW';
      case 'critical_high':
        return 'CRITICAL HIGH';
      case 'warning_low':
        return 'WARNING LOW';
      case 'warning_high':
        return 'WARNING HIGH';
      default:
        return 'THRESHOLD VIOLATION';
    }
  }

  /**
   * Check if a value is within safe operating range
   */
  isValueSafe(sensor: Sensor, value: number): boolean {
    const result = this.checkThresholds(sensor, value);
    return result.status !== 'critical';
  }

  /**
   * Get threshold summary for a sensor
   */
  getThresholdSummary(sensor: Sensor) {
    return {
      sensorId: sensor.sensor_id,
      type: sensor.type,
      unit: sensor.unit,
      thresholds: {
        min_critical: sensor.min_critical,
        min_warning: sensor.min_warning,
        max_warning: sensor.max_warning,
        max_critical: sensor.max_critical
      },
      actions: {
        low: sensor.action_low,
        high: sensor.action_high
      }
    };
  }
}