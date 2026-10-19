// src/modules/mqtt/mqtt.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventEmitterModule } from '@nestjs/event-emitter';

// Entities
import { Sensor } from '../../entities/sensor.entity';
import { SensorReading } from '../../entities/sensor-reading.entity';
import { ActionLog } from '../../entities/action-log.entity';
import { Device } from '../../entities/device.entity';
import { Farm } from '../farms/farm.entity';

// Core services
import { MqttConnectionService } from './mqtt-connection.service';
import { SensorDataService } from './sensor-data.service';

// Specialized services
import { SensorMessageParserService } from './services/sensor-message-parser.service';
import { SensorMatcherService } from './services/sensor-matcher.service';
import { ThresholdMonitorService } from './services/threshold-monitor.service';
import { ActionDispatcherService } from './services/action-dispatcher.service';
import { DeviceAcknowledgmentService } from './services/device-acknowledgment.service';
import { DeviceAckRegistrationService } from './services/device-ack-registration.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    // ✅ Register repositories for database access
    TypeOrmModule.forFeature([Sensor, SensorReading, ActionLog, Device, Farm]),
    
    // ✅ Add EventEmitter for threshold violations and action dispatching
    EventEmitterModule.forRoot({
      // Configuration for event handling
      wildcard: true,           // Enable wildcard events (e.g., 'sensor.*.threshold')
      delimiter: '.',           // Event namespace delimiter
      newListener: false,       // Don't emit newListener events
      removeListener: false,    // Don't emit removeListener events
      maxListeners: 50,         // Max listeners per event (increased for sensors)
      verboseMemoryLeak: true,  // Warn about memory leaks in development
      ignoreErrors: false,      // Don't ignore errors in event handlers
    }),
    // ✅ Notifications module to provide NotificationsService to MQTT services
    NotificationsModule,
  ],
  providers: [
    // ✅ Core MQTT services
    MqttConnectionService,     // MQTT connection management
    SensorDataService,         // Main orchestrator service
    
    // ✅ Specialized processing services
    SensorMessageParserService, // Parse raw MQTT messages
    SensorMatcherService,       // Match parsed values to sensors
    ThresholdMonitorService,    // Monitor sensor thresholds
    ActionDispatcherService,    // Execute actions on threshold violations
    DeviceAcknowledgmentService, // Handle device acknowledgments
    DeviceAckRegistrationService, // Register acknowledgment handlers
  ],
  exports: [
    // ✅ Export main services for other modules
    MqttConnectionService,      // For other modules to use MQTT functionality
    SensorDataService,          // For direct sensor data access
    
    // ✅ Export specialized services for advanced usage
    SensorMessageParserService, // For custom message parsing
    SensorMatcherService,       // For custom sensor matching logic
    ThresholdMonitorService,    // For custom threshold monitoring
    ActionDispatcherService,    // For manual action execution
  ],
})
export class MqttModule {}