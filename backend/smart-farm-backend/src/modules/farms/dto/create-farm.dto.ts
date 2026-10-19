import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateFarmDto {
  @IsNotEmpty()
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsString()
  description?: string;
}
