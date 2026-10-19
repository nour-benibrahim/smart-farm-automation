import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { LoginUserDto } from '../users/dto/login-user.dto';
import { SafeUser } from '../users/interfaces/user.interface';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  async validateUser(loginDto: LoginUserDto): Promise<SafeUser | null> {
    try {
      return await this.usersService.validateUser(loginDto);
    } catch (error) {
      throw error;
    }
  }

  async login(user: SafeUser) {
    const payload = { 
      email: user.email, 
      sub: user.user_id,
      role: user.role 
    };
    
    return {
      user,
      token: this.jwtService.sign(payload),
    };
  }

  async validateUserById(userId: string): Promise<SafeUser | null> {
    try {
      return await this.usersService.findOne(userId);
    } catch (error) {
      return null;
    }
  }
}
