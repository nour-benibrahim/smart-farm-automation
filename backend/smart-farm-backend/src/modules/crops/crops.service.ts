import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Crop } from '../../entities/crop.entity';
import { CreateCropDto } from './dto/create-crop.dto';
import { UpdateCropDto } from './dto/update-crop.dto';

@Injectable()
export class CropsService {
  constructor(
    @InjectRepository(Crop)
    private readonly cropsRepository: Repository<Crop>,
  ) {}

  async create(createCropDto: CreateCropDto): Promise<Crop> {
    const crop = this.cropsRepository.create(createCropDto);
    return this.cropsRepository.save(crop);
  }

  async findAll(includeSensors = false): Promise<Crop[]> {
    const relations = includeSensors ? ['sensors'] : [];
    
    return this.cropsRepository.find({
      relations,
      order: { created_at: 'DESC' }
    });
  }

  async findOne(id: string, includeSensors = false): Promise<Crop> {
    const relations = includeSensors ? ['sensors'] : [];
    
    const crop = await this.cropsRepository.findOne({
      where: { crop_id: id },
      relations,
    });

    if (!crop) {
      throw new NotFoundException(`Crop with ID ${id} not found`);
    }

    return crop;
  }

  async update(id: string, updateCropDto: UpdateCropDto): Promise<Crop> {
    const crop = await this.findOne(id);
    
    Object.assign(crop, updateCropDto);
    return this.cropsRepository.save(crop);
  }

  async remove(id: string): Promise<void> {
    const crop = await this.findOne(id);
    await this.cropsRepository.remove(crop);
  }

  async getCropSensors(cropId: string) {
    const crop = await this.findOne(cropId, true);
    return crop.sensors;
  }

  async getCropsByStatus(status: string): Promise<Crop[]> {
    return this.cropsRepository.find({
      where: { status },
      order: { created_at: 'DESC' }
    });
  }

  async getCropsByDateRange(startDate: Date, endDate: Date): Promise<Crop[]> {
    return this.cropsRepository
      .createQueryBuilder('crop')
      .where('crop.planting_date BETWEEN :startDate AND :endDate', { startDate, endDate })
      .orderBy('crop.planting_date', 'ASC')
      .getMany();
  }
}
