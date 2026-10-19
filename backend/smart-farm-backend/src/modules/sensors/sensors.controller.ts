import { Controller, Get, Post, Body, Param, Query, BadRequestException, Patch, Delete, UseGuards, Request } from '@nestjs/common';
import { SensorsService } from './sensors.service';
import { CreateSensorDto } from './dto/create-sensor.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('sensors')
export class SensorsController {
  constructor(private readonly sensorsService: SensorsService) {}

  @Post()
  async create(@Body() createSensorDto: CreateSensorDto) {
    try {
      return await this.sensorsService.create(createSensorDto);
    } catch (error) {
      if (error.code === 'ER_NO_REFERENCED_ROW_2') {
        throw new BadRequestException('Invalid farm_id, device_id, or crop_id provided');
      }
      throw error;
    }
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  async findAll(
    @Query('includeDevice') includeDevice?: string,
    @Query('includeFarm') includeFarm?: string,
    @Query('includeReadings') includeReadings?: string,
    @Request() req?: any
  ) {
    const shouldIncludeDevice = includeDevice === 'true';
    const shouldIncludeFarm = includeFarm === 'true';
    const shouldIncludeReadings = includeReadings === 'true';
    const ownerId = req?.user?.user_id;
    
    return this.sensorsService.findAll(shouldIncludeDevice, shouldIncludeFarm, shouldIncludeReadings, ownerId);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.sensorsService.findOne(+id);
  }

  @Get('by-sensor-id/:sensorId')
  async findBySensorId(@Param('sensorId') sensorId: string) {
    return this.sensorsService.findBySensorId(sensorId);
  }

  @Get('by-device/:deviceId')
  async findByDevice(@Param('deviceId') deviceId: string) {
    return this.sensorsService.findByDevice(deviceId);
  }

  @Get('by-farm/:farmId')
  async findByFarm(@Param('farmId') farmId: string) {
    return this.sensorsService.findByFarm(farmId);
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() updateData: any) {
    try {
      return await this.sensorsService.update(+id, updateData);
    } catch (error) {
      if (error.code === 'ER_NO_REFERENCED_ROW_2') {
        throw new BadRequestException('Invalid farm_id, device_id, or crop_id provided');
      }
      throw error;
    }
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    return this.sensorsService.remove(+id);
  }
}