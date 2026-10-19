import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

@Entity('action_logs')
export class ActionLog {
  @PrimaryGeneratedColumn()
  id: number;

  @CreateDateColumn({ type: 'timestamp' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updated_at: Date;

  @Column({ type: 'varchar', length: 10 })
  trigger_source: 'auto' | 'manual';

  @Index()
  @Column({ type: 'varchar', length: 100 })
  device_id: string;

  @Index()
  @Column({ type: 'varchar', length: 100, nullable: true })
  sensor_id: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  sensor_type: string | null;

  @Column({ type: 'float', nullable: true })
  value: number | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  unit: string | null;

  @Column({ type: 'varchar', length: 30, nullable: true })
  violation_type: string | null;

  @Column({ type: 'varchar', length: 255 })
  action_uri: string;

  @Column({ type: 'varchar', length: 50 })
  status: 'queued' | 'sent' | 'ack' | 'error' | 'timeout' | 'failed';

  @Column({ type: 'varchar', length: 255, nullable: true })
  topic: string | null;

  @Column({ type: 'text', nullable: true })
  error_message: string | null;

  @Column({ type: 'json', nullable: true })
  payload: any | null;

  // Production-ready fields
  @Index()
  @Column({ type: 'varchar', length: 100, nullable: true })
  action_id: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  action_type: 'critical' | 'important' | 'normal' | null;

  @Column({ type: 'int', nullable: true })
  qos_level: number | null;

  @Column({ type: 'boolean', nullable: true })
  retain_flag: boolean | null;

  @Column({ type: 'timestamp', nullable: true })
  sent_at: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  ack_at: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  timeout_at: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  failed_at: Date | null;

  @Column({ type: 'int', default: 0 })
  retry_count: number;

  @Column({ type: 'int', default: 1 })
  max_retries: number;
}

