// src/app.module.no-db.ts - No database version for Railway testing
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HealthNoDbModule } from './modules/health/health.module.nodb';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    HealthNoDbModule,
  ],
})
export class AppModuleNoDb {}
