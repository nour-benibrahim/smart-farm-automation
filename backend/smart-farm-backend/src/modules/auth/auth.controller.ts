import { Controller, Post, Body, HttpCode, HttpStatus, Res, Get, UseGuards, Req } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginUserDto } from '../users/dto/login-user.dto';
import { Response } from 'express';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { randomBytes } from 'crypto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() loginDto: LoginUserDto, @Res({ passthrough: true }) res: Response) {
    const user = await this.authService.validateUser(loginDto);
    const { token, user: safeUser } = await this.authService.login(user);
    res.cookie('sf_auth', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 1000 * 60 * 60 * 24, // 1 day
      path: '/',
    });
    return { user: safeUser };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie('sf_auth', { path: '/' });
    return { ok: true };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async me(@Req() req) {
    return req.user; // Return the user data from JWT strategy
  }

  @Get('csrf')
  @HttpCode(HttpStatus.OK)
  async csrf(@Res({ passthrough: true }) res: Response) {
    const token = randomBytes(32).toString('hex');
    res.cookie('sf_csrf', token, {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 1000 * 60 * 60 * 24,
      path: '/',
    });
    return { csrfToken: token };
  }
}
