import { Controller, Get, Query, Param, Post, Body, UseGuards } from '@nestjs/common';
import { ActionsService, GetActionsQuery, ExecuteActionDto } from './actions.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('actions')
@UseGuards(JwtAuthGuard)
export class ActionsController {
  constructor(private readonly svc: ActionsService) {}

  @Get()
  async list(@Query() query: GetActionsQuery) {
    return this.svc.list(query);
  }

  @Get(':id')
  async get(@Param('id') id: string) {
    return this.svc.get(+id);
  }

  @Post('execute')
  async execute(@Body() dto: ExecuteActionDto) {
    // TODO: Add role-based checks and whitelist validation on action
    return this.svc.executeManual(dto);
  }
}

