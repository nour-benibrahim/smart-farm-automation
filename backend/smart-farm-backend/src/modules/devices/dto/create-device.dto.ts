import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateDeviceDto {
  @IsNotEmpty()
  @IsString()
  device_id: string;

  @IsNotEmpty()
  @IsString()
  name: string;

  @IsNotEmpty()
  @IsString()
  location: string;

  @IsOptional()
  @IsString()
  status?: string; // 'online', 'offline', 'maintenance'

  @IsUUID()
  farm_id: string;

  @IsOptional()
  @IsString()
  device_type?: string; // 'sensor_hub', 'gateway', 'controller'

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  ip_address?: string;

  @IsOptional()
  @IsString()
  mac_address?: string;

  @IsOptional()
  @IsString()
  firmware_version?: string;

  @IsOptional()
  @IsString()
  last_seen?: string;
}
