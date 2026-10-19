import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Sensor } from '../../entities/sensor.entity';
import { Device } from '../../entities/device.entity';
import { Farm } from '../farms/farm.entity';
import { CreateSensorDto } from './dto/create-sensor.dto';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class SensorsService {
  constructor(
    @InjectRepository(Sensor)
    private readonly sensorsRepository: Repository<Sensor>,
    @InjectRepository(Device)
    private readonly deviceRepository: Repository<Device>,
    @InjectRepository(Farm)
    private readonly farmRepository: Repository<Farm>,
  ) {}

  async create(createSensorDto: CreateSensorDto): Promise<Sensor> {
    // Validate that farm exists
    const farm = await this.farmRepository.findOne({
      where: { farm_id: createSensorDto.farm_id }
    });
    if (!farm) {
      throw new BadRequestException(`Farm with ID ${createSensorDto.farm_id} not found`);
    }

    // Validate that device exists
    const device = await this.deviceRepository.findOne({
      where: { device_id: createSensorDto.device_id }
    });
    if (!device) {
      throw new BadRequestException(`Device with ID ${createSensorDto.device_id} not found`);
    }

    // Validate that device belongs to the specified farm
    if (device.farm_id !== createSensorDto.farm_id) {
      throw new BadRequestException(`Device ${createSensorDto.device_id} does not belong to farm ${createSensorDto.farm_id}`);
    }

    const sensor = this.sensorsRepository.create({
      ...createSensorDto,
      sensor_id: createSensorDto.sensor_id || uuidv4(),
    });

    return this.sensorsRepository.save(sensor);
  }

  async findAll(
    includeDevice = false, 
    includeFarm = false, 
    includeReadings = false,
    ownerId?: string
  ): Promise<Sensor[]> {
    const relations = [];
    
    if (includeDevice) relations.push('device');
    if (includeFarm) relations.push('farm');
    if (includeReadings) relations.push('readings');
    
    // Always include farm relation for filtering
    if (!relations.includes('farm')) {
      relations.push('farm');
    }

    const whereCondition = ownerId ? { farm: { owner_id: ownerId } } : {};

    return this.sensorsRepository.find({
      where: whereCondition,
      relations,
      order: { id: 'ASC' }
    });
  }

  async findOne(id: number): Promise<Sensor> {
    const sensor = await this.sensorsRepository.findOne({
      where: { id },
      relations: ['device', 'farm', 'crop']
    });

    if (!sensor) {
      throw new NotFoundException(`Sensor with ID ${id} not found`);
    }

    return sensor;
  }

  async findBySensorId(sensorId: string): Promise<Sensor[]> {
    const sensors = await this.sensorsRepository.find({
      where: { sensor_id: sensorId },
      relations: ['device', 'farm', 'crop']
    });

    if (!sensors.length) {
      throw new NotFoundException(`No sensors found with sensor_id ${sensorId}`);
    }

    return sensors;
  }

  async findByDevice(deviceId: string): Promise<Sensor[]> {
    // Validate device exists
    const device = await this.deviceRepository.findOne({
      where: { device_id: deviceId }
    });
    if (!device) {
      throw new NotFoundException(`Device with ID ${deviceId} not found`);
    }

    return this.sensorsRepository.find({
      where: { device_id: deviceId },
      relations: ['device', 'farm'],
      order: { id: 'ASC' }
    });
  }

  async findByFarm(farmId: string): Promise<Sensor[]> {
    // Validate farm exists
    const farm = await this.farmRepository.findOne({
      where: { farm_id: farmId }
    });
    if (!farm) {
      throw new NotFoundException(`Farm with ID ${farmId} not found`);
    }

    return this.sensorsRepository.find({
      where: { farm_id: farmId },
      relations: ['device', 'farm'],
      order: { id: 'ASC' }
    });
  }

  async update(id: number, updateData: Partial<Sensor>): Promise<Sensor> {
    const sensor = await this.findOne(id);
    
    // Remove id from updateData to prevent primary key modification
    const { id: _, ...updateFields } = updateData;
    
    Object.assign(sensor, updateFields);
    return this.sensorsRepository.save(sensor);
  }

  async remove(id: number): Promise<void> {
    const sensor = await this.findOne(id);
    await this.sensorsRepository.remove(sensor);
  }
}