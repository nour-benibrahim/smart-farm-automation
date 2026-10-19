import { DataSource } from 'typeorm';
import { ConfigModule } from '@nestjs/config';
import { Farm } from './src/modules/farms/farm.entity';
import { Sensor } from './src/entities/sensor.entity';
import { SensorReading } from './src/entities/sensor-reading.entity';
import { Device } from './src/entities/device.entity';
import { Crop } from './src/entities/crop.entity';
import { ActionLog } from './src/entities/action-log.entity';
import { Notification } from './src/entities/notification.entity';
import { User } from './src/entities/user.entity';

ConfigModule.forRoot({ isGlobal: true });

export const AppDataSource = new DataSource({
  type: 'mysql',
  host: process.env.DB_HOST!,
  username: process.env.DB_USER!,
  password: process.env.DB_PASS!,
  database: process.env.DB_NAME!,
  entities: [
  Farm,
  Sensor,
  SensorReading,
  Device,
  Crop,
  ActionLog,
  Notification,
  User,
],
  migrations: ['migrations/*.ts'],
});
