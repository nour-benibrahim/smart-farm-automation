import { Entity, PrimaryGeneratedColumn, Column, OneToMany, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { Sensor } from './sensor.entity';

@Entity('crops')
export class Crop {
  @PrimaryGeneratedColumn('uuid')
  crop_id: string;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  variety: string;

  @Column({ type: 'date', nullable: true })
  planting_date: Date;

  @Column({ type: 'date', nullable: true })
  expected_harvest_date: Date;

  @Column({ type: 'varchar', length: 50, default: 'planted' })
  status: string; // 'planted', 'growing', 'harvested', 'failed'

  @Column({ type: 'text', nullable: true })
  notes: string;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @OneToMany(() => Sensor, (sensor) => sensor.crop)
  sensors: Sensor[];
}
