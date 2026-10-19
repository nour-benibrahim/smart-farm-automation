import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { SensorReading } from '../../entities/sensor-reading.entity';
import { Sensor } from '../../entities/sensor.entity';
import { CreateSensorReadingDto } from './dto/create-sensor-reading.dto';

@Injectable()
export class SensorReadingsService {
  constructor(
    @InjectRepository(SensorReading)
    private readonly sensorReadingRepository: Repository<SensorReading>,
    @InjectRepository(Sensor)
    private readonly sensorRepository: Repository<Sensor>,
  ) {}

  async create(createSensorReadingDto: CreateSensorReadingDto): Promise<SensorReading> {
    // Validate that sensor exists
    const sensor = await this.sensorRepository.findOne({
      where: { sensor_id: createSensorReadingDto.sensor_id }
    });
    if (!sensor) {
      throw new NotFoundException(`Sensor with ID ${createSensorReadingDto.sensor_id} not found`);
    }

    const reading = this.sensorReadingRepository.create(createSensorReadingDto);
    return this.sensorReadingRepository.save(reading);
  }

  async findAll(limit = 100, offset = 0, ownerId?: string): Promise<SensorReading[]> {
    console.log('SensorReadingsService.findAll called with:', { limit, offset, ownerId });
    
    // First, let's check if there are any readings at all
    const allReadings = await this.sensorReadingRepository.find({
      relations: ['sensor', 'sensor.farm'],
      order: { createdAt: 'DESC' },
      take: 10
    });
    console.log('Total readings in database:', allReadings.length);
    if (allReadings.length > 0) {
      console.log('Sample reading:', {
        id: allReadings[0].id,
        sensor_id: allReadings[0].sensor_id,
        value1: allReadings[0].value1,
        sensor: allReadings[0].sensor ? {
          id: allReadings[0].sensor.id,
          sensor_id: allReadings[0].sensor.sensor_id,
          farm_id: allReadings[0].sensor.farm_id,
          type: allReadings[0].sensor.type,
          unit: allReadings[0].sensor.unit
        } : 'NO SENSOR',
        farm: allReadings[0].sensor?.farm ? {
          farm_id: allReadings[0].sensor.farm.farm_id,
          owner_id: allReadings[0].sensor.farm.owner_id
        } : 'NO FARM'
      });
    }
    
    const whereCondition = ownerId ? { sensor: { farm: { owner_id: ownerId } } } : {};
    console.log('Where condition:', whereCondition);
    
    const readings = await this.sensorReadingRepository.find({
      where: whereCondition,
      relations: ['sensor', 'sensor.farm'],
      order: { createdAt: 'DESC' },
      take: limit,
      skip: offset
    });
    
    console.log('Found readings:', readings.length);
    return readings;
  }

  async findOne(id: number): Promise<SensorReading> {
    const reading = await this.sensorReadingRepository.findOne({
      where: { id },
      relations: ['sensor']
    });

    if (!reading) {
      throw new NotFoundException(`Sensor reading with ID ${id} not found`);
    }

    return reading;
  }

  async findBySensor(sensorId: string, limit = 100, offset = 0): Promise<SensorReading[]> {
    // Validate that sensor exists
    const sensor = await this.sensorRepository.findOne({
      where: { sensor_id: sensorId }
    });
    if (!sensor) {
      throw new NotFoundException(`Sensor with ID ${sensorId} not found`);
    }

    return this.sensorReadingRepository.find({
      where: { sensor_id: sensorId },
      relations: ['sensor'],
      order: { createdAt: 'DESC' },
      take: limit,
      skip: offset
    });
  }

  async getLatestReading(sensorId: string): Promise<SensorReading | null> {
    return this.sensorReadingRepository.findOne({
      where: { sensor_id: sensorId },
      relations: ['sensor'],
      order: { createdAt: 'DESC' }
    });
  }

  async getReadingsByDateRange(
    sensorId: string,
    startDate: Date,
    endDate: Date,
    limit = 1000
  ): Promise<SensorReading[]> {
    return this.sensorReadingRepository.find({
      where: {
        sensor_id: sensorId,
        createdAt: Between(startDate, endDate)
      },
      relations: ['sensor'],
      order: { createdAt: 'ASC' },
      take: limit
    });
  }

  async getReadingsByFarm(farmId: string, limit = 100, offset = 0): Promise<SensorReading[]> {
    return this.sensorReadingRepository
      .createQueryBuilder('reading')
      .innerJoin('reading.sensor', 'sensor')
      .where('sensor.farm_id = :farmId', { farmId })
      .orderBy('reading.createdAt', 'DESC')
      .take(limit)
      .skip(offset)
      .getMany();
  }

  async getReadingsByDevice(deviceId: string, limit = 100, offset = 0): Promise<SensorReading[]> {
    return this.sensorReadingRepository
      .createQueryBuilder('reading')
      .innerJoin('reading.sensor', 'sensor')
      .where('sensor.device_id = :deviceId', { deviceId })
      .orderBy('reading.createdAt', 'DESC')
      .take(limit)
      .skip(offset)
      .getMany();
  }

  async getSensorStatistics(sensorId: string, days = 7): Promise<any> {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const readings = await this.sensorReadingRepository.find({
      where: {
        sensor_id: sensorId,
        createdAt: Between(startDate, endDate)
      },
      order: { createdAt: 'ASC' }
    });

    if (readings.length === 0) {
      return {
        sensorId,
        period: `${days} days`,
        count: 0,
        average: null,
        min: null,
        max: null,
        latest: null
      };
    }

    const values = readings.map(r => r.value1).filter(v => v !== null);
    const average = values.reduce((sum, val) => sum + val, 0) / values.length;
    const min = Math.min(...values);
    const max = Math.max(...values);
    const latest = readings[readings.length - 1];

    return {
      sensorId,
      period: `${days} days`,
      count: readings.length,
      average: Math.round(average * 100) / 100,
      min,
      max,
      latest: {
        value: latest.value1,
        timestamp: latest.createdAt
      }
    };
  }

  async getFarmStatistics(farmId: string, days = 7): Promise<any> {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const readings = await this.sensorReadingRepository
      .createQueryBuilder('reading')
      .innerJoin('reading.sensor', 'sensor')
      .where('sensor.farm_id = :farmId', { farmId })
      .andWhere('reading.createdAt BETWEEN :startDate AND :endDate', { startDate, endDate })
      .getMany();

    const sensorStats = new Map();
    
    readings.forEach(reading => {
      if (!sensorStats.has(reading.sensor_id)) {
        sensorStats.set(reading.sensor_id, {
          sensorId: reading.sensor_id,
          values: [],
          count: 0
        });
      }
      
      const stats = sensorStats.get(reading.sensor_id);
      if (reading.value1 !== null) {
        stats.values.push(reading.value1);
        stats.count++;
      }
    });

    const result = Array.from(sensorStats.values()).map(stats => ({
      sensorId: stats.sensorId,
      count: stats.count,
      average: stats.values.length > 0 ? Math.round((stats.values.reduce((sum, val) => sum + val, 0) / stats.values.length) * 100) / 100 : null,
      min: stats.values.length > 0 ? Math.min(...stats.values) : null,
      max: stats.values.length > 0 ? Math.max(...stats.values) : null
    }));

    return {
      farmId,
      period: `${days} days`,
      totalReadings: readings.length,
      sensors: result
    };
  }

  async remove(id: number): Promise<void> {
    const reading = await this.findOne(id);
    await this.sensorReadingRepository.remove(reading);
  }

  async removeOldReadings(olderThanDays: number): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    const result = await this.sensorReadingRepository
      .createQueryBuilder()
      .delete()
      .where('createdAt < :cutoffDate', { cutoffDate })
      .execute();

    return result.affected || 0;
  }
}
