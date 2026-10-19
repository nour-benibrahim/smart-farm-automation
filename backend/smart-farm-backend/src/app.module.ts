// src/app.module.ts
import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MqttModule } from './modules/mqtt/mqtt.module';
import { SensorsModule } from './modules/sensors/sensors.module';
import { FarmsModule } from './modules/farms/farms.module';
import { UsersModule } from './modules/users/users.module';
import { CropsModule } from './modules/crops/crops.module';
import { DevicesModule } from './modules/devices/devices.module';
import { SensorReadingsModule } from './modules/sensor-readings/sensor-readings.module';
import { HealthModule } from './modules/health/health.module';
import { AuthModule } from './modules/auth/auth.module';
import { ActionsModule } from './modules/actions/actions.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { typeOrmConfig } from './config/typeorm.config';
import { CsrfMiddleware } from './common/middleware/csrf.middleware';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{ ttl: 60, limit: 20 }]),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: typeOrmConfig,
    }),
    UsersModule,
    FarmsModule,
    SensorsModule,
    CropsModule,
    DevicesModule,
    SensorReadingsModule,
    HealthModule,
    MqttModule,
    AuthModule,
    ActionsModule,
    NotificationsModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(CsrfMiddleware).forRoutes('*');
  }
}