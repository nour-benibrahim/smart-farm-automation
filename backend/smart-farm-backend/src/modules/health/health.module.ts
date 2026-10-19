import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../../entities/user.entity';
import { Farm } from '../farms/farm.entity';
import { Device } from '../../entities/device.entity';
import { Sensor } from '../../entities/sensor.entity';
import { SensorReading } from '../../entities/sensor-reading.entity';
import { Crop } from '../../entities/crop.entity';
import { MqttModule } from '../mqtt/mqtt.module';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      Farm,
      Device,
      Sensor,
      SensorReading,
      Crop
    ]),
    MqttModule
  ],
  controllers: [HealthController],
  providers: [HealthService],
  exports: [HealthService],
})
export class HealthModule {}
