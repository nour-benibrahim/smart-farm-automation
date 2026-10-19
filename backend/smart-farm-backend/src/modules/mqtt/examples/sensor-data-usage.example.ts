// src/modules/mqtt/examples/sensor-data-usage.example.ts
import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { SensorDataService } from '../sensor-data.service';
import { SensorMessageParserService } from '../services/sensor-message-parser.service';
import { SensorMatcherService } from '../services/sensor-matcher.service';
import { ThresholdMonitorService, ThresholdViolation } from '../services/threshold-monitor.service';
import { ActionDispatcherService, ActionResult } from '../services/action-dispatcher.service';

@Injectable()
export class SensorDataUsageExample {
  private readonly logger = new Logger(SensorDataUsageExample.name);

  constructor(
    private sensorDataService: SensorDataService,
    private messageParser: SensorMessageParserService,
    private sensorMatcher: SensorMatcherService,
    private thresholdMonitor: ThresholdMonitorService,
    private actionDispatcher: ActionDispatcherService,
  ) {}

  /**
   * Example: Test message parsing
   */
  async testMessageParsing() {
    const testMessages = [
      '25.5°C,65%',
      '23.2°C,45%,300lux',
      '26.8°C,78%,pH7.2',
      '22°C,60%,1013hPa'
    ];

    for (const message of testMessages) {
      this.logger.log(`Testing message: ${message}`);
      const parsed = this.messageParser.parseMessageWithUnits(message);
      this.logger.log('Parsed result:', parsed);
    }
  }

  /**
   * Example: Test sensor data processing
   */
  async testSensorDataProcessing() {
    const deviceId = 'greenhouse-01';
    const testMessage = '26.5°C,75%';

    try {
      const result = await this.sensorDataService.processTestMessage(deviceId, testMessage);
      this.logger.log('Processing result:', result);
    } catch (error) {
      this.logger.error('Test failed:', error);
    }
  }

  /**
   * Example: Get device statistics
   */
  async showDeviceStats() {
    const deviceId = 'greenhouse-01';
    const stats = await this.sensorDataService.getDeviceStats(deviceId);
    this.logger.log('Device statistics:', stats);
  }

  /**
   * Example: Manual action execution
   */
  async testActionExecution() {
    const context = {
      sensorId: 'temp-01',
      sensorType: 'Temperature',
      deviceId: 'greenhouse-01',
      value: 35.5,
      unit: '°C',
      violationType: 'critical_high',
      timestamp: new Date()
    };

    // Test different action types
    const actions = [
      'alert:high_temperature',
      'email:admin@farm.com',
      'sms:+1234567890',
      'actuator:fan_on',
      'mqtt:smartfarm/alerts/temperature'
    ];

    for (const action of actions) {
      try {
        const result = await this.actionDispatcher.executeAction(action, context);
        this.logger.log(`Action result for ${action}:`, result);
      } catch (error) {
        this.logger.error(`Action failed for ${action}:`, error);
      }
    }
  }

  /**
   * Example: Service health check
   */
  async checkSystemHealth() {
    const health = await this.sensorDataService.healthCheck();
    this.logger.log('System health:', health);
  }

  // Event listeners for demonstration

  @OnEvent('threshold.violation')
  handleThresholdViolation(violation: ThresholdViolation) {
    this.logger.log(`🚨 Threshold violation detected:`, {
      sensor: violation.sensor.type,
      value: violation.value,
      type: violation.violationType,
      timestamp: violation.timestamp
    });
  }

  @OnEvent('action.executed')
  handleActionExecuted(result: ActionResult) {
    this.logger.log(`⚙️ Action executed:`, {
      action: result.action,
      success: result.success,
      sensor: result.context.sensorType,
      executedAt: result.executedAt
    });
  }

  @OnEvent('sensor.reading.saved')
  handleReadingSaved(data: any) {
    this.logger.log(`💾 New sensor reading saved:`, data);
  }

  @OnEvent('alert.sent')
  handleAlertSent(alertData: any) {
    this.logger.log(`📢 Alert sent:`, alertData);
  }

  @OnEvent('email.queued')
  handleEmailQueued(emailData: any) {
    this.logger.log(`📧 Email queued:`, {
      to: emailData.to,
      subject: emailData.subject
    });
  }

  @OnEvent('mqtt.publish')
  handleMqttPublish(mqttData: any) {
    this.logger.log(`📡 MQTT message published:`, {
      topic: mqttData.topic,
      messageLength: mqttData.message.length
    });
  }
}

// Test runner class
@Injectable()
export class SensorDataTestRunner {
  private readonly logger = new Logger(SensorDataTestRunner.name);

  constructor(private example: SensorDataUsageExample) {}

  async runAllTests() {
    this.logger.log('🧪 Starting sensor data service tests...');

    try {
      await this.example.testMessageParsing();
      await this.delay(1000);

      await this.example.testSensorDataProcessing();
      await this.delay(1000);

      await this.example.showDeviceStats();
      await this.delay(1000);

      await this.example.testActionExecution();
      await this.delay(1000);

      await this.example.checkSystemHealth();

      this.logger.log('✅ All tests completed successfully');
    } catch (error) {
      this.logger.error('❌ Test suite failed:', error);
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}