// src/entities/sensor.entity.ts
import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { Farm } from '../modules/farms/farm.entity';
import { Crop } from '../entities/crop.entity';
import { SensorReading } from './sensor-reading.entity';

@Entity('sensors')
export class Sensor {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 36 })
  sensor_id: string;

  @Column({ type: 'varchar', length: 100 })
  farm_id: string;

  @Column({ type: 'varchar', length: 50 })
  type: string;

  @Column({ type: 'varchar', length: 20 })
  unit: string;

  @Column({ type: 'varchar', length: 100 })
  device_id: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  location: string;

  @Column({ type: 'uuid', nullable: true })
  crop_id: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  min_critical: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  min_warning: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  max_warning: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  max_critical: number;

  @Column({ type: 'text', nullable: true })
  action_low: string;

  @Column({ type: 'text', nullable: true })
  action_high: string;

  // Relationship with Farm
  @ManyToOne(() => Farm, (farm) => farm.sensors)
  @JoinColumn({ name: 'farm_id' })
  farm: Farm;

  // Relationship with Crop
  @ManyToOne(() => Crop, (crop) => crop.sensors)
  @JoinColumn({ name: 'crop_id' })
  crop: Crop;

  // Relationship with Device
  @ManyToOne('Device', (device: any) => device.sensors)
  @JoinColumn({ name: 'device_id' })
  device: Promise<any>;

  // Relationship with SensorReadings
  @OneToMany(() => SensorReading, (reading) => reading.sensor)
  readings: SensorReading[];
}