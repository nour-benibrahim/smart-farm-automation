// src/modules/users/dto/create-user.dto.ts
import { IsEmail, IsString, IsOptional, IsEnum, IsDateString, MinLength, IsPhoneNumber } from 'class-validator';
import { UserRole, UserStatus } from '../../../entities/user.entity';

export class CreateUserDto {
  @IsOptional()
  @IsString()
  user_id?: string;

  @IsEmail()
  email: string;

  @IsString()
  @MinLength(6)
  password: string;

  @IsString()
  first_name: string;

  @IsString()
  last_name: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  country?: string;

  @IsOptional()
  @IsDateString()
  date_of_birth?: Date;

  @IsOptional()
  @IsString()
  gender?: string;

  @IsOptional()
  @IsString()
  profile_picture?: string;
}


