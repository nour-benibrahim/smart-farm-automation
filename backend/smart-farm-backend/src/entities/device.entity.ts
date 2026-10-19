import { Entity, PrimaryColumn, Column, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { Farm } from '../modules/farms/farm.entity';

@Entity('devices')
export class Device {
  @PrimaryColumn({ type: 'varchar', length: 100 })
  device_id: string;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'varchar', length: 255 })
  location: string;

  @Column({ type: 'varchar', length: 50, default: 'offline' })
  status: string; // 'online', 'offline', 'maintenance'

  @Column({ type: 'varchar', length: 36 })
  farm_id: string;

  // @Column({ type: 'varchar', length: 50, nullable: true })
  // device_type: string; // 'sensor_hub', 'gateway', 'controller'

  // @Column({ type: 'text', nullable: true })
  // description: string;

  // @Column({ type: 'varchar', length: 45, nullable: true })
  // ip_address: string;

  // @Column({ type: 'varchar', length: 17, nullable: true })
  // mac_address: string;

  // @Column({ type: 'varchar', length: 20, nullable: true })
  // firmware_version: string;

  // @Column({ type: 'datetime', nullable: true })
  // last_seen: Date;

  // Relationship with Farm
  @ManyToOne(() => Farm, (farm) => farm.devices)
  @JoinColumn({ name: 'farm_id' })
  farm: Farm;

  // Relationship with Sensors (one device can have many sensors)
  @OneToMany('Sensor', (sensor: any) => sensor.device, { lazy: true })
  sensors: Promise<any[]>;
}