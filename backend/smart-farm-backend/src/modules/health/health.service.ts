import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../entities/user.entity';
import { Farm } from '../farms/farm.entity';
import { Device } from '../../entities/device.entity';
import { Sensor } from '../../entities/sensor.entity';
import { SensorReading } from '../../entities/sensor-reading.entity';
import { Crop } from '../../entities/crop.entity';
import { MqttConnectionService } from '../mqtt/mqtt-connection.service';
import { SensorDataService } from '../mqtt/sensor-data.service';

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Farm)
    private readonly farmRepository: Repository<Farm>,
    @InjectRepository(Device)
    private readonly deviceRepository: Repository<Device>,
    @InjectRepository(Sensor)
    private readonly sensorRepository: Repository<Sensor>,
    @InjectRepository(SensorReading)
    private readonly sensorReadingRepository: Repository<SensorReading>,
    @InjectRepository(Crop)
    private readonly cropRepository: Repository<Crop>,
    private readonly mqttConnectionService: MqttConnectionService,
    private readonly sensorDataService: SensorDataService,
  ) {}

  async getSystemHealth() {
    try {
      const databaseHealth = await this.getDatabaseHealth();
      const mqttHealth = await this.getMqttHealth();
      const sensorsHealth = await this.getSensorsHealth();

      const overallStatus = 
        databaseHealth.status === 'healthy' && 
        mqttHealth.status === 'healthy' && 
        sensorsHealth.status === 'healthy' 
          ? 'healthy' 
          : 'unhealthy';

      return {
        status: overallStatus,
        timestamp: new Date(),
        services: {
          database: databaseHealth.status,
          mqtt: mqttHealth.status,
          sensors: sensorsHealth.status
        },
        uptime: process.uptime(),
        version: '1.0.0'
      };
    } catch (error) {
      this.logger.error('Health check failed:', error);
      return {
        status: 'unhealthy',
        timestamp: new Date(),
        error: error.message
      };
    }
  }

  async getDatabaseHealth() {
    try {
      // Test database connectivity by running simple queries
      const userCount = await this.userRepository.count();
      const farmCount = await this.farmRepository.count();
      const deviceCount = await this.deviceRepository.count();
      const sensorCount = await this.sensorRepository.count();
      const readingCount = await this.sensorReadingRepository.count();
      const cropCount = await this.cropRepository.count();

      return {
        status: 'healthy',
        timestamp: new Date(),
        metrics: {
          users: userCount,
          farms: farmCount,
          devices: deviceCount,
          sensors: sensorCount,
          readings: readingCount,
          crops: cropCount
        }
      };
    } catch (error) {
      this.logger.error('Database health check failed:', error);
      return {
        status: 'unhealthy',
        timestamp: new Date(),
        error: error.message
      };
    }
  }

  async getMqttHealth() {
    try {
      const mqttStatus = this.mqttConnectionService.getConnectionStatus();
      
      return {
        status: mqttStatus.connected ? 'healthy' : 'unhealthy',
        timestamp: new Date(),
        connection: mqttStatus,
        broker: {
          url: mqttStatus.brokerUrl,
          connected: mqttStatus.connected,
          reconnecting: mqttStatus.reconnecting
        }
      };
    } catch (error) {
      this.logger.error('MQTT health check failed:', error);
      return {
        status: 'unhealthy',
        timestamp: new Date(),
        error: error.message
      };
    }
  }

  async getSensorsHealth() {
    try {
      const sensorHealth = await this.sensorDataService.healthCheck();
      
      return {
        status: sensorHealth.status,
        timestamp: new Date(),
        metrics: sensorHealth.metrics,
        topicStructure: sensorHealth.topicStructure,
        messageFormat: sensorHealth.messageFormat
      };
    } catch (error) {
      this.logger.error('Sensors health check failed:', error);
      return {
        status: 'unhealthy',
        timestamp: new Date(),
        error: error.message
      };
    }
  }

  async getDetailedHealth() {
    try {
      const [databaseHealth, mqttHealth, sensorsHealth] = await Promise.all([
        this.getDatabaseHealth(),
        this.getMqttHealth(),
        this.getSensorsHealth()
      ]);

      // Get recent activity metrics
      const last24Hours = new Date();
      last24Hours.setHours(last24Hours.getHours() - 24);

      const recentReadings = await this.sensorReadingRepository
        .createQueryBuilder('reading')
        .where('reading.createdAt >= :date', { date: last24Hours })
        .getCount();

      const onlineDevices = await this.deviceRepository.count({ 
        where: { status: 'online' } 
      });

      const totalDevices = await this.deviceRepository.count();

      return {
        status: 'healthy',
        timestamp: new Date(),
        services: {
          database: databaseHealth,
          mqtt: mqttHealth,
          sensors: sensorsHealth
        },
        system: {
          uptime: process.uptime(),
          memory: process.memoryUsage(),
          cpu: process.cpuUsage(),
          version: '1.0.0',
          nodeVersion: process.version,
          platform: process.platform
        },
        activity: {
          recentReadings24h: recentReadings,
          onlineDevices,
          totalDevices,
          deviceOnlinePercentage: totalDevices > 0 ? Math.round((onlineDevices / totalDevices) * 100) : 0
        }
      };
    } catch (error) {
      this.logger.error('Detailed health check failed:', error);
      return {
        status: 'unhealthy',
        timestamp: new Date(),
        error: error.message
      };
    }
  }
}
