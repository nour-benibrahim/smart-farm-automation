// src/entities/sensor-reading.entity.ts

import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Sensor } from './sensor.entity';

@Entity('sensor_readings')
export class SensorReading {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Sensor, (sensor) => sensor.readings)
  @JoinColumn({ name: 'sensor_id', referencedColumnName: 'sensor_id' })
  sensor: Sensor;

  @Column()
  sensor_id: string;

  @Column({ type: 'float', nullable: true })
  value1: number;

  @Column({ type: 'float', nullable: true })
  value2: number;

  @CreateDateColumn()
  createdAt: Date;
}