import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere } from 'typeorm';
import { ActionLog } from '../../entities/action-log.entity';
import { ActionDispatcherService } from '../mqtt/services/action-dispatcher.service';

export interface ExecuteActionDto {
  deviceId: string;
  action: string; // either 'mqtt:...' or logical action name
  actionId?: string; // Frontend-generated action ID for tracking
  actionType?: 'critical' | 'important' | 'normal'; // Action criticality level
  payload?: any;
  context?: {
    sensorId?: string;
    sensorType?: string;
    value?: number;
    unit?: string;
    violationType?: string;
  };
}

export interface GetActionsQuery {
  limit?: number;
  offset?: number;
  device_id?: string;
  sensor_id?: string;
  source?: 'auto' | 'manual';
  status?: 'queued' | 'sent' | 'ack' | 'error';
  from?: string; // ISO
  to?: string;   // ISO
}

@Injectable()
export class ActionsService {
  constructor(
    @InjectRepository(ActionLog) private readonly repo: Repository<ActionLog>,
    private readonly dispatcher: ActionDispatcherService,
  ) {}

  async list(query: GetActionsQuery) {
    const where: FindOptionsWhere<ActionLog> = {};
    if (query.device_id) where.device_id = query.device_id;
    if (query.sensor_id) where.sensor_id = query.sensor_id;
    if (query.source) where.trigger_source = query.source;
    if (query.status) where.status = query.status;

    const qb = this.repo.createQueryBuilder('a').where(where);
    if (query.from) qb.andWhere('a.created_at >= :from', { from: query.from });
    if (query.to) qb.andWhere('a.created_at <= :to', { to: query.to });
    qb.orderBy('a.created_at', 'DESC');
    qb.skip(query.offset ?? 0);
    qb.take(Math.min(query.limit ?? 50, 200));
    const [items, total] = await qb.getManyAndCount();
    return { items, total };
  }

  async get(id: number) {
    return this.repo.findOne({ where: { id } });
  }

  async executeManual(dto: ExecuteActionDto) {
    const ok = await this.dispatcher.executeManual(dto.action, {
      deviceId: dto.deviceId,
      sensorId: dto.context?.sensorId || '',
      sensorType: dto.context?.sensorType || '',
      value: dto.context?.value ?? 0,
      unit: dto.context?.unit || '',
      violationType: dto.context?.violationType,
      timestamp: new Date(),
    }, dto.actionType || 'normal', dto.actionId);
    return { ok };
  }
}

