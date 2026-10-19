import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class HealthNoDbController {
  @Get()
  getHealth() {
    return {
      status: 'healthy',
      timestamp: new Date(),
      uptime: process.uptime(),
      version: '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      port: process.env.PORT || 3000,
    };
  }
}


