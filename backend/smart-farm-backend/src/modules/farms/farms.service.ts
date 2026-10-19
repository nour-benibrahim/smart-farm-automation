import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Farm } from './farm.entity';
import { Device } from '../../entities/device.entity';
import { Sensor } from '../../entities/sensor.entity';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class FarmsService {
  constructor(
    @InjectRepository(Farm)
    private readonly farmRepository: Repository<Farm>,
    @InjectRepository(Device)
    private readonly deviceRepository: Repository<Device>,
    @InjectRepository(Sensor)
    private readonly sensorRepository: Repository<Sensor>,
  ) {}

  async findAll(includeDevices = false, ownerId?: string): Promise<Farm[]> {
    const relations = [];
    if (includeDevices) {
      relations.push('devices', 'devices.sensors');
    }

    const whereCondition = ownerId ? { owner_id: ownerId } : {};

    return this.farmRepository.find({
      where: whereCondition,
      relations,
    });
  }

  async findOne(id: string, includeDevices = false, includeSensors = false): Promise<Farm> {
    const relations = [];
    
    if (includeDevices) {
      relations.push('devices');
    }
    if (includeSensors) {
      relations.push('sensors');
    }
    if (includeDevices && includeSensors) {
      relations.push('devices.sensors');
    }

    const farm = await this.farmRepository.findOne({
      where: { farm_id: id },
      relations,
    });

    if (!farm) {
      throw new NotFoundException(`Farm with ID ${id} not found`);
    }

    return farm;
  }

  async getFarmDevices(farmId: string) {
    const farm = await this.farmRepository.findOne({
      where: { farm_id: farmId },
    });

    if (!farm) {
      throw new NotFoundException(`Farm with ID ${farmId} not found`);
    }

    return this.deviceRepository.find({
      where: { farm_id: farmId },
      relations: ['sensors'],
    });
  }

  async getFarmSensors(farmId: string) {
    const farm = await this.farmRepository.findOne({
      where: { farm_id: farmId },
    });

    if (!farm) {
      throw new NotFoundException(`Farm with ID ${farmId} not found`);
    }

    return this.sensorRepository.find({
      where: { farm_id: farmId },
      relations: ['device'],
    });
  }

  async create(data: Partial<Farm>, ownerId: string): Promise<Farm> {
    const farm = this.farmRepository.create({
      farm_id: data.farm_id || uuidv4(),
      name: data.name,
      location: data.location,
      owner_id: ownerId,
    });
    return this.farmRepository.save(farm);
  }

  async findById(id: string): Promise<Farm> {
    const farm = await this.farmRepository.findOne({
      where: { farm_id: id },
    });

    if (!farm) {
      throw new NotFoundException(`Farm with ID ${id} not found`);
    }

    return farm;
  }
}