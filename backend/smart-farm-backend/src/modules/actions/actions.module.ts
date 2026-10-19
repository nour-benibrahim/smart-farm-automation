import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ActionLog } from '../../entities/action-log.entity';
import { ActionsService } from './actions.service';
import { ActionsController } from './actions.controller';
import { MqttModule } from '../mqtt/mqtt.module';

@Module({
  imports: [TypeOrmModule.forFeature([ActionLog]), MqttModule],
  providers: [ActionsService],
  controllers: [ActionsController],
  exports: [ActionsService],
})
export class ActionsModule {}

