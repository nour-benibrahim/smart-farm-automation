import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Device } from '../../entities/device.entity';
import { Farm } from '../farms/farm.entity';
import { CreateDeviceDto } from './dto/create-device.dto';
import { UpdateDeviceDto } from './dto/update-device.dto';

@Injectable()
export class DevicesService {
  constructor(
    @InjectRepository(Device)
    private readonly devicesRepository: Repository<Device>,
    @InjectRepository(Farm)
    private readonly farmRepository: Repository<Farm>,
  ) {}

  async create(createDeviceDto: CreateDeviceDto): Promise<Device> {
    // Validate that farm exists
    const farm = await this.farmRepository.findOne({
      where: { farm_id: createDeviceDto.farm_id }
    });
    if (!farm) {
      throw new BadRequestException(`Farm with ID ${createDeviceDto.farm_id} not found`);
    }

    // Check if device_id already exists
    const existingDevice = await this.devicesRepository.findOne({
      where: { device_id: createDeviceDto.device_id }
    });
    if (existingDevice) {
      throw new BadRequestException(`Device with ID ${createDeviceDto.device_id} already exists`);
    }

    const device = this.devicesRepository.create(createDeviceDto);
    return this.devicesRepository.save(device);
  }

  async findAll(includeSensors = false, ownerId?: string): Promise<Device[]> {
    const relations = includeSensors ? ['sensors'] : [];
    relations.push('farm');
    
    const whereCondition = ownerId ? { farm: { owner_id: ownerId } } : {};
    
    return this.devicesRepository.find({
      where: whereCondition,
      relations
      // order: { created_at: 'DESC' } // Commented out - column doesn't exist
    });
  }

  async findOne(id: string, includeSensors = false): Promise<Device> {
    const relations = includeSensors ? ['sensors'] : [];
    
    const device = await this.devicesRepository.findOne({
      where: { device_id: id },
      relations,
    });

    if (!device) {
      throw new NotFoundException(`Device with ID ${id} not found`);
    }

    return device;
  }

  async update(id: string, updateDeviceDto: UpdateDeviceDto): Promise<Device> {
    const device = await this.findOne(id);
    
    Object.assign(device, updateDeviceDto);
    return this.devicesRepository.save(device);
  }

  async remove(id: string): Promise<void> {
    const device = await this.findOne(id);
    await this.devicesRepository.remove(device);
  }

  async getDevicesByFarm(farmId: string): Promise<Device[]> {
    // Validate farm exists
    const farm = await this.farmRepository.findOne({
      where: { farm_id: farmId }
    });
    if (!farm) {
      throw new NotFoundException(`Farm with ID ${farmId} not found`);
    }

    return this.devicesRepository.find({
      where: { farm_id: farmId },
      relations: ['sensors']
      // order: { created_at: 'DESC' } // Commented out - column doesn't exist
    });
  }

  async getDevicesByStatus(status: string): Promise<Device[]> {
    return this.devicesRepository.find({
      where: { status },
      relations: ['farm']
      // order: { created_at: 'DESC' } // Commented out - column doesn't exist
    });
  }

  async updateDeviceStatus(deviceId: string, status: string): Promise<Device> {
    const device = await this.findOne(deviceId);
    device.status = status;
    // device.last_seen = new Date(); // Commented out - column doesn't exist
    return this.devicesRepository.save(device);
  }

  async getDeviceStatistics(): Promise<any> {
    const totalDevices = await this.devicesRepository.count();
    const onlineDevices = await this.devicesRepository.count({ where: { status: 'online' } });
    const offlineDevices = await this.devicesRepository.count({ where: { status: 'offline' } });
    const maintenanceDevices = await this.devicesRepository.count({ where: { status: 'maintenance' } });

    return {
      total: totalDevices,
      online: onlineDevices,
      offline: offlineDevices,
      maintenance: maintenanceDevices,
      onlinePercentage: totalDevices > 0 ? Math.round((onlineDevices / totalDevices) * 100) : 0
    };
  }

  // async getDevicesByType(deviceType: string): Promise<Device[]> {
  //   return this.devicesRepository.find({
  //     where: { device_type: deviceType },
  //     relations: ['farm'],
  //     order: { created_at: 'DESC' }
  //   });
  // }
}
