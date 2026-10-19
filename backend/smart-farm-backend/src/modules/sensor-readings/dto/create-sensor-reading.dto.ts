import { IsNotEmpty, IsOptional, IsString, IsNumber, IsDateString } from 'class-validator';

export class CreateSensorReadingDto {
  @IsNotEmpty()
  @IsString()
  sensor_id: string;

  @IsOptional()
  @IsNumber()
  value1?: number;

  @IsOptional()
  @IsNumber()
  value2?: number;

  @IsOptional()
  @IsDateString()
  createdAt?: Date;
}
