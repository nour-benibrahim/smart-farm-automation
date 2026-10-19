// src/modules/mqtt/services/sensor-message-parser.service.ts
import { Injectable, Logger } from '@nestjs/common';

export interface ParsedValue {
  value: number;
  unit: string;
  raw: string;
}

@Injectable()
export class SensorMessageParserService {
  private readonly logger = new Logger(SensorMessageParserService.name);

  /**
   * Parse message like "14.5°C,60%" into structured data
   */
  parseMessageWithUnits(message: string): ParsedValue[] {
    const values = message.split(',').map(v => v.trim());
    const parsedValues: ParsedValue[] = [];

    for (const rawValue of values) {
      const match = rawValue.match(/^([\d.-]+)(.*)$/);
      if (match) {
        const numericValue = parseFloat(match[1]);
        const unit = match[2].trim() || ''; // Could be empty for unitless values
        
        if (!isNaN(numericValue)) {
          parsedValues.push({
            value: numericValue,
            unit: unit,
            raw: rawValue
          });
        }
      }
    }

    this.logger.log(`📊 Parsed ${parsedValues.length} values from: ${message}`);
    return parsedValues;
  }

  /**
   * Extract device ID from MQTT topic
   */
  extractDeviceId(topic: string): string | null {
    const topicParts = topic.split('/');
    if (topicParts.length >= 3 && topicParts[0] === 'smartfarm' && topicParts[1] === 'sensors') {
      return topicParts[2];
    }
    return null;
  }

  /**
   * Normalize units to handle encoding issues with degree symbols
   */
  normalizeUnit(unit: string): string {
    return unit
      .replace(/[°�]/g, '') // Remove degree symbols (both proper and corrupted)
      .toLowerCase()
      .trim();
  }

  /**
   * Validate if a message format is supported
   */
  isValidMessageFormat(message: string): boolean {
    try {
      const parsed = this.parseMessageWithUnits(message);
      return parsed.length > 0;
    } catch (error) {
      this.logger.warn(`Invalid message format: ${message}`, error);
      return false;
    }
  }
}