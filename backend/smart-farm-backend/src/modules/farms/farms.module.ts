import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FarmsController } from './farms.controller';
import { FarmsService } from './farms.service';
import { Farm } from './farm.entity';
import { Device } from '../../entities/device.entity';
import { Sensor } from '../../entities/sensor.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Farm, Device, Sensor])],
  controllers: [FarmsController],
  providers: [FarmsService],
  exports: [FarmsService],
})
export class FarmsModule {}