import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UseGuards, Request } from '@nestjs/common';
import { DevicesService } from './devices.service';
import { CreateDeviceDto } from './dto/create-device.dto';
import { UpdateDeviceDto } from './dto/update-device.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('devices')
export class DevicesController {
  constructor(private readonly devicesService: DevicesService) {}

  @Post()
  async create(@Body() createDeviceDto: CreateDeviceDto) {
    return this.devicesService.create(createDeviceDto);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  async findAll(@Query('includeSensors') includeSensors?: string, @Request() req?: any) {
    const shouldIncludeSensors = includeSensors === 'true';
    const ownerId = req?.user?.user_id;
    return this.devicesService.findAll(shouldIncludeSensors, ownerId);
  }

  @Get('statistics')
  async getStatistics() {
    return this.devicesService.getDeviceStatistics();
  }

  @Get('by-status/:status')
  async findByStatus(@Param('status') status: string) {
    return this.devicesService.getDevicesByStatus(status);
  }

  // @Get('by-type/:type')
  // async findByType(@Param('type') type: string) {
  //   return this.devicesService.getDevicesByType(type);
  // }

  @Get('by-farm/:farmId')
  async findByFarm(@Param('farmId') farmId: string) {
    return this.devicesService.getDevicesByFarm(farmId);
  }

  @Get(':id')
  async findOne(
    @Param('id') id: string,
    @Query('includeSensors') includeSensors?: string
  ) {
    const shouldIncludeSensors = includeSensors === 'true';
    return this.devicesService.findOne(id, shouldIncludeSensors);
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() updateDeviceDto: UpdateDeviceDto) {
    return this.devicesService.update(id, updateDeviceDto);
  }

  @Patch(':id/status')
  async updateStatus(
    @Param('id') id: string,
    @Body() body: { status: string }
  ) {
    return this.devicesService.updateDeviceStatus(id, body.status);
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    await this.devicesService.remove(id);
    return { message: 'Device deleted successfully' };
  }
}
