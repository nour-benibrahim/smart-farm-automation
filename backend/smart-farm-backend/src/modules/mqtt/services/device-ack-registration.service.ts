import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { MqttConnectionService } from '../mqtt-connection.service';
import { DeviceAcknowledgmentService } from './device-acknowledgment.service';

@Injectable()
export class DeviceAckRegistrationService implements OnModuleInit {
  private readonly logger = new Logger(DeviceAckRegistrationService.name);

  constructor(
    private readonly mqttConnectionService: MqttConnectionService,
    private readonly deviceAckService: DeviceAcknowledgmentService,
  ) {}

  onModuleInit() {
    this.logger.log('🔧 Registering device acknowledgment message handler...');
    
    // Register device acknowledgment handler
    this.mqttConnectionService.registerMessageHandler(
      'device-ack-handler',
      (topic: string, payload: Buffer) => {
        this.logger.debug(`📩 [ACK-REGISTRATION] Received message on topic: ${topic}`);
        
        // Handle device acknowledgments
        if (topic.includes('/ack')) {
          this.logger.log(`🎯 [ACK-REGISTRATION] Routing acknowledgment message to handler`);
          this.deviceAckService.handleDeviceAck(topic, payload);
        }
        // Handle device status updates
        else if (topic.includes('/status')) {
          this.logger.log(`📊 [ACK-REGISTRATION] Routing status message to handler`);
          this.deviceAckService.handleDeviceStatus(topic, payload);
        }
        else {
          this.logger.debug(`🔍 [ACK-REGISTRATION] Ignoring non-device message: ${topic}`);
        }
      }
    );
    
    this.logger.log('✅ Device acknowledgment message handler registered successfully');
  }
}
