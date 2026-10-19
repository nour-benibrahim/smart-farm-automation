// src/modules/users/users.controller.ts
import { 
  Controller, 
  Get, 
  Post, 
  Body, 
  Patch, 
  Param, 
  Delete, 
  Query,
  HttpCode,
  HttpStatus 
} from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { LoginUserDto } from './dto/login-user.dto';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post('register')
  async register(@Body() createUserDto: CreateUserDto) {
    return this.usersService.create(createUserDto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() loginDto: LoginUserDto) {
    return this.usersService.validateUser(loginDto);
  }

  @Get()
  async findAll(@Query('includeFarms') includeFarms?: string) {
    const shouldIncludeFarms = includeFarms === 'true';
    return this.usersService.findAll(shouldIncludeFarms);
  }

  @Get(':id')
  async findOne(
    @Param('id') id: string,
    @Query('includeFarms') includeFarms?: string
  ) {
    const shouldIncludeFarms = includeFarms === 'true';
    return this.usersService.findOne(id, shouldIncludeFarms);
  }

  @Get(':id/farms')
  async getUserFarms(@Param('id') id: string) {
    return this.usersService.getUserFarms(id);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string, 
    @Body() updateUserDto: UpdateUserDto
  ) {
    return this.usersService.update(id, updateUserDto);
  }

  @Patch(':id/password')
  async updatePassword(
    @Param('id') id: string,
    @Body() body: { password: string }
  ) {
    await this.usersService.updatePassword(id, body.password);
    return { message: 'Password updated successfully' };
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    await this.usersService.remove(id);
    return { message: 'User deleted successfully' };
  }
}