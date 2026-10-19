import { Controller, Get, Post, Body, Patch, Param, Delete, Query } from '@nestjs/common';
import { CropsService } from './crops.service';
import { CreateCropDto } from './dto/create-crop.dto';
import { UpdateCropDto } from './dto/update-crop.dto';

@Controller('crops')
export class CropsController {
  constructor(private readonly cropsService: CropsService) {}

  @Post()
  async create(@Body() createCropDto: CreateCropDto) {
    return this.cropsService.create(createCropDto);
  }

  @Get()
  async findAll(@Query('includeSensors') includeSensors?: string) {
    const shouldIncludeSensors = includeSensors === 'true';
    return this.cropsService.findAll(shouldIncludeSensors);
  }

  @Get('by-status/:status')
  async findByStatus(@Param('status') status: string) {
    return this.cropsService.getCropsByStatus(status);
  }

  @Get('by-date-range')
  async findByDateRange(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string
  ) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    return this.cropsService.getCropsByDateRange(start, end);
  }

  @Get(':id')
  async findOne(
    @Param('id') id: string,
    @Query('includeSensors') includeSensors?: string
  ) {
    const shouldIncludeSensors = includeSensors === 'true';
    return this.cropsService.findOne(id, shouldIncludeSensors);
  }

  @Get(':id/sensors')
  async getCropSensors(@Param('id') id: string) {
    return this.cropsService.getCropSensors(id);
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() updateCropDto: UpdateCropDto) {
    return this.cropsService.update(id, updateCropDto);
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    await this.cropsService.remove(id);
    return { message: 'Crop deleted successfully' };
  }
}
