import { Module } from '@nestjs/common';
import { HealthNoDbController } from './health.controller.nodb';

@Module({
  controllers: [HealthNoDbController],
})
export class HealthNoDbModule {}


