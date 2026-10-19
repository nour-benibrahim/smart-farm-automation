import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Notification } from '../../entities/notification.entity';
import { Device } from '../../entities/device.entity';
import { Farm } from '../farms/farm.entity';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { NotificationsGateway } from './notifications.gateway';
import { ActionNotificationsService } from './action-notifications.service';

@Module({
  imports: [TypeOrmModule.forFeature([Notification, Device, Farm])],
  providers: [NotificationsService, NotificationsGateway, ActionNotificationsService],
  controllers: [NotificationsController],
  exports: [NotificationsService],
})
export class NotificationsModule {}


