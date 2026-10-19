import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere } from 'typeorm';
import { Notification } from '../../entities/notification.entity';

export interface CreateNotificationDto {
  user_id: string;
  level: 'critical' | 'warning' | 'info' | 'success';
  source: 'sensor' | 'device' | 'action' | 'system' | 'security' | 'maintenance';
  title: string;
  message?: string;
  context?: any;
}

export interface QueryNotificationsDto {
  limit?: number;
  offset?: number;
  is_read?: '0' | '1';
  level?: string;
  source?: string;
  from?: string;
  to?: string;
}

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(Notification) private readonly repo: Repository<Notification>,
    private readonly events: EventEmitter2,
  ) {}

  async create(dto: CreateNotificationDto): Promise<Notification> {
    console.log('🔔 [NOTIFICATIONS] Creating notification:', dto);
    const n = this.repo.create({ ...dto, is_read: false });
    const saved = await this.repo.save(n);
    console.log('🔔 [NOTIFICATIONS] Notification created:', saved.id);
    // Emit event for websockets
    this.events.emit('notification.created', saved);
    return saved;
  }

  async list(user_id: string, q: QueryNotificationsDto) {
    console.log('📡 [NOTIFICATIONS] Listing notifications for user:', user_id, 'with query:', q);
    const where: FindOptionsWhere<Notification> = { user_id };
    if (q.is_read !== undefined) (where as any).is_read = q.is_read === '1' ? 1 : 0;
    if (q.level) (where as any).level = q.level;
    if (q.source) (where as any).source = q.source;

    const qb = this.repo.createQueryBuilder('n').where(where);
    if (q.from) qb.andWhere('n.created_at >= :from', { from: q.from });
    if (q.to) qb.andWhere('n.created_at <= :to', { to: q.to });
    qb.orderBy('n.created_at', 'DESC');
    qb.skip(q.offset ?? 0);
    qb.take(Math.min(q.limit ?? 50, 200));
    const [items, total] = await qb.getManyAndCount();
    console.log('📡 [NOTIFICATIONS] Found notifications:', items.length, 'total:', total);
    return { items, total };
  }

  async unreadCount(user_id: string) {
    const count = await this.repo.count({ where: { user_id, is_read: false as unknown as any } });
    return { count };
  }

  async markRead(user_id: string, ids: string[]) {
    if (!ids?.length) return { updated: 0 };
    const res = await this.repo.createQueryBuilder()
      .update(Notification)
      .set({ is_read: true as unknown as any })
      .where('user_id = :user_id', { user_id })
      .andWhere('id IN (:...ids)', { ids })
      .execute();
    return { updated: res.affected ?? 0 };
  }

  async markAllRead(user_id: string) {
    const res = await this.repo.createQueryBuilder()
      .update(Notification)
      .set({ is_read: true as unknown as any })
      .where('user_id = :user_id', { user_id })
      .andWhere('is_read = :zero', { zero: 0 })
      .execute();
    return { updated: res.affected ?? 0 };
  }

  async deleteOne(user_id: string, id: string) {
    const res = await this.repo.createQueryBuilder()
      .delete()
      .from(Notification)
      .where('user_id = :user_id', { user_id })
      .andWhere('id = :id', { id })
      .execute();
    return { deleted: res.affected ?? 0 };
  }
}


