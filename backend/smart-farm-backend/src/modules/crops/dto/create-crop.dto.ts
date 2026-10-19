import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateCropDto {
  @IsNotEmpty()
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  variety?: string;

  @IsOptional()
  @IsString()
  planting_date?: string;

  @IsOptional()
  @IsString()
  expected_harvest_date?: string;

  @IsOptional()
  @IsString()
  status?: string; // 'planted', 'growing', 'harvested', 'failed'

  @IsOptional()
  @IsString()
  notes?: string;
}
