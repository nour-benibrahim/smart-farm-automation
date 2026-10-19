import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ActionLog } from '../../../entities/action-log.entity';
import { Device } from '../../../entities/device.entity';
import { EventEmitter2 } from '@nestjs/event-emitter';

@Injectable()
export class DeviceAcknowledgmentService {
  private readonly logger = new Logger(DeviceAcknowledgmentService.name);
  
  // Track device heartbeats for offline detection
  private deviceHeartbeats = new Map<string, Date>();
  private readonly OFFLINE_THRESHOLD_MINUTES = 0.5; // Mark as offline if no heartbeat for 35 minutes (30min + 5min buffer)

  constructor(
    @InjectRepository(ActionLog)
    private readonly actionLogRepo: Repository<ActionLog>,
    @InjectRepository(Device)
    private readonly deviceRepo: Repository<Device>,
    private readonly eventEmitter: EventEmitter2,
  ) {
    // Start periodic offline detection
    this.startOfflineDetection();
  }

  /**
   * Handle device acknowledgment messages
   */
  public handleDeviceAck(topic: string, payload: Buffer): void {
    try {
      const message = payload.toString();
      this.logger.log(`📨 [DEVICE-ACK] Device acknowledgment received on ${topic}: ${message}`);

      // Parse topic: smartfarm/devices/{device_id}/ack
      const topicParts = topic.split('/');
      if (topicParts.length !== 4 || topicParts[0] !== 'smartfarm' || topicParts[1] !== 'devices' || topicParts[3] !== 'ack') {
        this.logger.warn(`⚠️ Invalid device ack topic format: ${topic}`);
        return;
      }

      const deviceId = topicParts[2];
      
      // Parse acknowledgment message
      let ackData;
      try {
        ackData = JSON.parse(message);
      } catch (error) {
        this.logger.warn(`⚠️ Invalid JSON in device ack: ${message}`);
        return;
      }

      // Process the acknowledgment
      this.processDeviceAcknowledgment(deviceId, ackData);

    } catch (error) {
      this.logger.error(`❌ Error processing device acknowledgment:`, error);
    }
  }

  /**
   * Process device acknowledgment
   */
  private async processDeviceAcknowledgment(deviceId: string, ackData: any): Promise<void> {
    try {
      const { actionId, status, error, timestamp } = ackData;

      if (!actionId) {
        this.logger.warn(`⚠️ Device ack missing actionId: ${JSON.stringify(ackData)}`);
        return;
      }

      // Find the action log by action_id
      const actionLog = await this.actionLogRepo.findOne({
        where: { action_id: actionId }
      });

      if (!actionLog) {
        this.logger.warn(`⚠️ No action log found for actionId: ${actionId}`);
        return;
      }

      // Update action status based on device response
      if (status === 'success' || status === 'executed') {
        await this.actionLogRepo.update(actionLog.id, {
          status: 'ack',
          ack_at: new Date(),
          error_message: null
        });

        this.logger.log(`✅ Action ${actionId} acknowledged as successful by device ${deviceId}`);
        
        // Emit success event
        this.eventEmitter.emit('action.acknowledged', {
          actionId,
          deviceId,
          status: 'success',
          actionLogId: actionLog.id
        });

      } else if (status === 'error' || status === 'failed') {
        await this.actionLogRepo.update(actionLog.id, {
          status: 'failed',
          failed_at: new Date(),
          error_message: error || 'Device reported execution failure'
        });

        this.logger.error(`❌ Action ${actionId} failed on device ${deviceId}: ${error || 'Unknown error'}`);
        
        // Emit failure event
        this.eventEmitter.emit('action.failed', {
          actionId,
          deviceId,
          error: error || 'Device execution failure',
          actionLogId: actionLog.id
        });

      } else {
        this.logger.warn(`⚠️ Unknown device ack status: ${status} for action ${actionId}`);
      }

    } catch (error) {
      this.logger.error(`❌ Error processing device acknowledgment for device ${deviceId}:`, error);
    }
  }

  /**
   * Handle device status messages
   */
  public handleDeviceStatus(topic: string, payload: Buffer): void {
    try {
      const message = payload.toString();
      this.logger.log(`📊 Device status received on ${topic}: ${message}`);

      // Parse topic: smartfarm/devices/{device_id}/status
      const topicParts = topic.split('/');
      if (topicParts.length !== 4 || topicParts[0] !== 'smartfarm' || topicParts[1] !== 'devices' || topicParts[3] !== 'status') {
        this.logger.warn(`⚠️ Invalid device status topic format: ${topic}`);
        return;
      }

      const deviceId = topicParts[2];
      
      // Parse status message
      let statusData;
      try {
        statusData = JSON.parse(message);
      } catch (error) {
        this.logger.warn(`⚠️ Invalid JSON in device status: ${message}`);
        return;
      }

      // Process device status update
      this.processDeviceStatus(deviceId, statusData);

    } catch (error) {
      this.logger.error(`❌ Error processing device status:`, error);
    }
  }

  /**
   * Process device status update
   */
  private async processDeviceStatus(deviceId: string, statusData: any): Promise<void> {
    try {
      const { status, timestamp, capabilities, lastSeen } = statusData;
      
      this.logger.log(`📊 Device ${deviceId} status: ${status}`);
      
      // Update device status in database
      await this.updateDeviceStatusInDatabase(deviceId, status, lastSeen);
      
      // Emit device status event for other services
      this.eventEmitter.emit('device.status', {
        deviceId,
        status,
        timestamp,
        capabilities,
        lastSeen
      });

    } catch (error) {
      this.logger.error(`❌ Error processing device status for device ${deviceId}:`, error);
    }
  }

  /**
   * Update device status in database
   */
  private async updateDeviceStatusInDatabase(deviceId: string, status: string, lastSeen?: string): Promise<void> {
    try {
      // Find the device by device_id
      const device = await this.deviceRepo.findOne({
        where: { device_id: deviceId }
      });

      if (!device) {
        this.logger.warn(`⚠️ Device ${deviceId} not found in database, skipping status update`);
        return;
      }

      // Update device status
      const updateData: any = { status };
      
      // Note: last_seen field is commented out in device.entity.ts
      // If you want to track last_seen, you'll need to uncomment that field first
      // if (lastSeen) {
      //   updateData.last_seen = new Date(lastSeen);
      // }

      await this.deviceRepo.update(device.device_id, updateData);
      
      // Track heartbeat for offline detection
      if (status === 'online') {
        this.deviceHeartbeats.set(deviceId, new Date());
      }
      
      this.logger.log(`✅ Updated device ${deviceId} status to: ${status}`);

    } catch (error) {
      this.logger.error(`❌ Error updating device status in database for ${deviceId}:`, error);
    }
  }

  /**
   * Start periodic offline detection
   */
  private startOfflineDetection(): void {
    // Check for offline devices every 5 minutes
    setInterval(async () => {
      await this.checkForOfflineDevices();
    }, 300000); // 5 minutes = 300,000 milliseconds
    
    this.logger.log(`🔄 Started offline detection (threshold: ${this.OFFLINE_THRESHOLD_MINUTES} minutes)`);
  }

  /**
   * Check for devices that should be marked as offline
   */
  private async checkForOfflineDevices(): Promise<void> {
    try {
      const now = new Date();
      const offlineDevices: string[] = [];

      // Check each tracked device
      for (const [deviceId, lastHeartbeat] of this.deviceHeartbeats.entries()) {
        const minutesSinceLastHeartbeat = (now.getTime() - lastHeartbeat.getTime()) / (1000 * 60);
        
        if (minutesSinceLastHeartbeat > this.OFFLINE_THRESHOLD_MINUTES) {
          offlineDevices.push(deviceId);
        }
      }

      // Mark devices as offline
      for (const deviceId of offlineDevices) {
        await this.markDeviceOffline(deviceId);
        this.deviceHeartbeats.delete(deviceId); // Remove from tracking
      }

      if (offlineDevices.length > 0) {
        this.logger.log(`📴 Marked ${offlineDevices.length} devices as offline: ${offlineDevices.join(', ')}`);
      }

    } catch (error) {
      this.logger.error(`❌ Error checking for offline devices:`, error);
    }
  }

  /**
   * Mark a device as offline
   */
  private async markDeviceOffline(deviceId: string): Promise<void> {
    try {
      await this.deviceRepo.update(
        { device_id: deviceId },
        { status: 'offline' }
      );
      
      this.logger.log(`📴 Marked device ${deviceId} as offline`);
      
      // Emit offline event
      this.eventEmitter.emit('device.status', {
        deviceId,
        status: 'offline',
        timestamp: new Date().toISOString(),
        reason: 'No heartbeat received'
      });

    } catch (error) {
      this.logger.error(`❌ Error marking device ${deviceId} as offline:`, error);
    }
  }

  /**
   * Get current device heartbeat status (for debugging/testing)
   */
  public getDeviceHeartbeatStatus(): { deviceId: string; lastHeartbeat: Date; minutesSinceLastHeartbeat: number }[] {
    const now = new Date();
    return Array.from(this.deviceHeartbeats.entries()).map(([deviceId, lastHeartbeat]) => ({
      deviceId,
      lastHeartbeat,
      minutesSinceLastHeartbeat: (now.getTime() - lastHeartbeat.getTime()) / (1000 * 60)
    }));
  }
}
