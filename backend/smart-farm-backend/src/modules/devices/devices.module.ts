import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Device } from '../../entities/device.entity';
import { Farm } from '../farms/farm.entity';
import { Sensor } from '../../entities/sensor.entity';
import { DevicesController } from './devices.controller';
import { DevicesService } from './devices.service';
import { DeviceActionsController } from './device-actions.controller';
import { DeviceActionsService } from './device-actions.service';

@Module({
  imports: [TypeOrmModule.forFeature([Device, Farm, Sensor])],
  controllers: [DevicesController, DeviceActionsController],
  providers: [DevicesService, DeviceActionsService],
  exports: [DevicesService, DeviceActionsService],
})
export class DevicesModule {}
