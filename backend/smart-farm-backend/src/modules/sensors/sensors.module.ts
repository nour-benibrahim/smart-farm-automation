import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Sensor } from '../../entities/sensor.entity';
import { Crop } from '../../entities/crop.entity';
import { Device } from '../../entities/device.entity';
import { Farm } from '../farms/farm.entity';
import { SensorsService } from './sensors.service';
import { SensorsController } from './sensors.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Sensor, Crop, Device, Farm])],
  controllers: [SensorsController],
  providers: [SensorsService],
  exports: [SensorsService],
})
export class SensorsModule {}