import { Controller, Get, Post, Body, Param, Delete, Query, UseGuards, Request } from '@nestjs/common';
import { SensorReadingsService } from './sensor-readings.service';
import { CreateSensorReadingDto } from './dto/create-sensor-reading.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('sensor-readings')
export class SensorReadingsController {
  constructor(private readonly sensorReadingsService: SensorReadingsService) {}

  @Post()
  async create(@Body() createSensorReadingDto: CreateSensorReadingDto) {
    return this.sensorReadingsService.create(createSensorReadingDto);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  async findAll(
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Request() req?: any
  ) {
    const limitNum = limit ? parseInt(limit, 10) : 100;
    const offsetNum = offset ? parseInt(offset, 10) : 0;
    const ownerId = req?.user?.user_id;
    console.log('SensorReadingsController.findAll called with:', { limitNum, offsetNum, ownerId, user: req?.user });
    return this.sensorReadingsService.findAll(limitNum, offsetNum, ownerId);
  }

  @Get('by-sensor/:sensorId')
  async findBySensor(
    @Param('sensorId') sensorId: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string
  ) {
    const limitNum = limit ? parseInt(limit, 10) : 100;
    const offsetNum = offset ? parseInt(offset, 10) : 0;
    return this.sensorReadingsService.findBySensor(sensorId, limitNum, offsetNum);
  }

  @Get('by-sensor/:sensorId/latest')
  async getLatestReading(@Param('sensorId') sensorId: string) {
    return this.sensorReadingsService.getLatestReading(sensorId);
  }

  @Get('by-sensor/:sensorId/statistics')
  async getSensorStatistics(
    @Param('sensorId') sensorId: string,
    @Query('days') days?: string
  ) {
    const daysNum = days ? parseInt(days, 10) : 7;
    return this.sensorReadingsService.getSensorStatistics(sensorId, daysNum);
  }

  @Get('by-sensor/:sensorId/date-range')
  async getReadingsByDateRange(
    @Param('sensorId') sensorId: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('limit') limit?: string
  ) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const limitNum = limit ? parseInt(limit, 10) : 1000;
    return this.sensorReadingsService.getReadingsByDateRange(sensorId, start, end, limitNum);
  }

  @Get('by-farm/:farmId')
  async getReadingsByFarm(
    @Param('farmId') farmId: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string
  ) {
    const limitNum = limit ? parseInt(limit, 10) : 100;
    const offsetNum = offset ? parseInt(offset, 10) : 0;
    return this.sensorReadingsService.getReadingsByFarm(farmId, limitNum, offsetNum);
  }

  @Get('by-farm/:farmId/statistics')
  async getFarmStatistics(
    @Param('farmId') farmId: string,
    @Query('days') days?: string
  ) {
    const daysNum = days ? parseInt(days, 10) : 7;
    return this.sensorReadingsService.getFarmStatistics(farmId, daysNum);
  }

  @Get('by-device/:deviceId')
  async getReadingsByDevice(
    @Param('deviceId') deviceId: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string
  ) {
    const limitNum = limit ? parseInt(limit, 10) : 100;
    const offsetNum = offset ? parseInt(offset, 10) : 0;
    return this.sensorReadingsService.getReadingsByDevice(deviceId, limitNum, offsetNum);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.sensorReadingsService.findOne(+id);
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    await this.sensorReadingsService.remove(+id);
    return { message: 'Sensor reading deleted successfully' };
  }

  @Delete('cleanup/old-readings')
  async removeOldReadings(@Query('olderThanDays') olderThanDays?: string) {
    const days = olderThanDays ? parseInt(olderThanDays, 10) : 30;
    const deletedCount = await this.sensorReadingsService.removeOldReadings(days);
    return { 
      message: `Deleted ${deletedCount} old sensor readings older than ${days} days` 
    };
  }
}
