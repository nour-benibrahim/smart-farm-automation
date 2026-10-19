import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SensorReading } from '../../entities/sensor-reading.entity';
import { Sensor } from '../../entities/sensor.entity';
import { SensorReadingsController } from './sensor-readings.controller';
import { SensorReadingsService } from './sensor-readings.service';

@Module({
  imports: [TypeOrmModule.forFeature([SensorReading, Sensor])],
  controllers: [SensorReadingsController],
  providers: [SensorReadingsService],
  exports: [SensorReadingsService],
})
export class SensorReadingsModule {}
