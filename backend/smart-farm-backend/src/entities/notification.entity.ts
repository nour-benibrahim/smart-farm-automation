import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index, BeforeInsert } from 'typeorm';
import { randomUUID } from 'crypto';

@Entity('notifications')
export class Notification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @BeforeInsert()
  generateId() {
    if (!this.id) {
      this.id = randomUUID();
    }
  }

  @Index('idx_notifications_user_read_created')
  @Column({ type: 'varchar', length: 36 })
  user_id: string;

  @Column({ type: 'varchar', length: 10 })
  level: 'critical' | 'warning' | 'info' | 'success';

  @Column({ type: 'varchar', length: 20 })
  source: 'sensor' | 'device' | 'action' | 'system' | 'security' | 'maintenance';

  @Column({ type: 'varchar', length: 200 })
  title: string;

  @Column({ type: 'text', nullable: true })
  message?: string;

  @Column({ type: 'json', nullable: true })
  context?: any;

  @Index()
  @Column({ type: 'boolean', default: false })
  is_read: boolean;

  @CreateDateColumn({ type: 'timestamp', precision: 6 })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamp', precision: 6 })
  updated_at: Date;
}


