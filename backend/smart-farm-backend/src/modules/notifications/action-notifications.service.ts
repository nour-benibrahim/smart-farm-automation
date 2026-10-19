import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Device } from '../../entities/device.entity';
import { Farm } from '../farms/farm.entity';
import { NotificationsService } from './notifications.service';

@Injectable()
export class ActionNotificationsService {
  private readonly logger = new Logger(ActionNotificationsService.name);

  constructor(
    @InjectRepository(Device)
    private readonly deviceRepo: Repository<Device>,
    @InjectRepository(Farm)
    private readonly farmRepo: Repository<Farm>,
    private readonly notificationsService: NotificationsService,
  ) {}

  @OnEvent('action.timeout')
  async handleActionTimeout(data: any) {
    this.logger.log(`🔔 [ACTION-NOTIFICATIONS] Processing action timeout: ${data.actionId}`);
    
    try {
      // Get device info to find the farm owner
      const device = await this.deviceRepo.findOne({
        where: { device_id: data.deviceId },
        relations: ['farm']
      });

      if (!device || !device.farm) {
        this.logger.warn(`🔔 [ACTION-NOTIFICATIONS] Device or farm not found for device: ${data.deviceId}`);
        return;
      }

      const farmOwnerId = device.farm.owner_id;
      this.logger.log(`🔔 [ACTION-NOTIFICATIONS] Creating timeout notification for user: ${farmOwnerId}`);

      // Create notification for the farm owner
      await this.notificationsService.create({
        user_id: farmOwnerId,
        level: 'warning',
        source: 'action',
        title: 'Action Timeout',
        message: `${data.actionCommand} action timed out on device ${data.deviceId}`,
        context: {
          actionId: data.actionId,
          actionCommand: data.actionCommand,
          deviceId: data.deviceId,
          actionLogId: data.actionLogId,
          type: 'timeout'
        }
      });

      this.logger.log(`🔔 [ACTION-NOTIFICATIONS] Timeout notification created successfully`);
    } catch (error) {
      this.logger.error(`🔔 [ACTION-NOTIFICATIONS] Error creating timeout notification:`, error);
    }
  }

  @OnEvent('action.executed')
  async handleActionExecuted(data: any) {
    this.logger.log(`🔔 [ACTION-NOTIFICATIONS] Processing action executed: ${data.action}`);
    
    try {
      // Get device info to find the farm owner
      const device = await this.deviceRepo.findOne({
        where: { device_id: data.deviceId },
        relations: ['farm']
      });

      if (!device || !device.farm) {
        this.logger.warn(`🔔 [ACTION-NOTIFICATIONS] Device or farm not found for device: ${data.deviceId}`);
        return;
      }

      const farmOwnerId = device.farm.owner_id;
      this.logger.log(`🔔 [ACTION-NOTIFICATIONS] Creating executed notification for user: ${farmOwnerId}`);

      // Create notification for the farm owner
      await this.notificationsService.create({
        user_id: farmOwnerId,
        level: 'success',
        source: 'action',
        title: 'Action Executed',
        message: `${data.action} action executed successfully on device ${data.deviceId}`,
        context: {
          action: data.action,
          deviceId: data.deviceId,
          type: 'executed'
        }
      });

      this.logger.log(`🔔 [ACTION-NOTIFICATIONS] Executed notification created successfully`);
    } catch (error) {
      this.logger.error(`🔔 [ACTION-NOTIFICATIONS] Error creating executed notification:`, error);
    }
  }

  @OnEvent('action.failed')
  async handleActionFailed(data: any) {
    this.logger.log(`🔔 [ACTION-NOTIFICATIONS] Processing action failed: ${data.actionId}`);
    
    try {
      // Get device info to find the farm owner
      const device = await this.deviceRepo.findOne({
        where: { device_id: data.deviceId },
        relations: ['farm']
      });

      if (!device || !device.farm) {
        this.logger.warn(`🔔 [ACTION-NOTIFICATIONS] Device or farm not found for device: ${data.deviceId}`);
        return;
      }

      const farmOwnerId = device.farm.owner_id;
      this.logger.log(`🔔 [ACTION-NOTIFICATIONS] Creating failed notification for user: ${farmOwnerId}`);

      // Create notification for the farm owner
      await this.notificationsService.create({
        user_id: farmOwnerId,
        level: 'critical',
        source: 'action',
        title: 'Action Failed',
        message: `${data.actionCommand || 'Action'} failed on device ${data.deviceId}`,
        context: {
          actionId: data.actionId,
          actionCommand: data.actionCommand,
          deviceId: data.deviceId,
          error: data.error,
          type: 'failed'
        }
      });

      this.logger.log(`🔔 [ACTION-NOTIFICATIONS] Failed notification created successfully`);
    } catch (error) {
      this.logger.error(`🔔 [ACTION-NOTIFICATIONS] Error creating failed notification:`, error);
    }
  }
}
