// src/modules/users/interfaces/user.interface.ts
import { UserRole, UserStatus } from '../../../entities/user.entity';

export interface SafeUser {
  user_id: string;
  email: string;
  first_name: string;
  last_name: string;
  phone?: string;
  role: UserRole;
  status: UserStatus;
  address?: string;
  city?: string;
  country?: string;
  date_of_birth?: Date;
  gender?: string;
  profile_picture?: string;
  last_login?: Date;
  reset_token?: string;
  reset_token_expires?: Date;
  created_at: Date;
  updated_at: Date;
  farms?: any[];
}

export interface CreateUserResponse {
  user_id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: UserRole;
  status: UserStatus;
  created_at: Date;
}

export interface LoginResponse {
  user: SafeUser;
  message: string;
}

export interface UserWithFarms extends SafeUser {
  farms: any[];
}