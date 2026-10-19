import { Controller, Get, Query, Post, Body, UseGuards, Request, Delete, Param } from '@nestjs/common';
import { NotificationsService, QueryNotificationsDto } from './notifications.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly svc: NotificationsService) {}

  @Get()
  async list(@Query() query: QueryNotificationsDto, @Request() req: any) {
    const userId = req.user.user_id;
    return this.svc.list(userId, query);
  }

  @Get('unread-count')
  async unread(@Request() req: any) {
    const userId = req.user.user_id;
    return this.svc.unreadCount(userId);
  }

  @Post('mark-read')
  async markRead(@Body() body: { ids: string[] }, @Request() req: any) {
    const userId = req.user.user_id;
    return this.svc.markRead(userId, body.ids || []);
  }

  @Post('mark-all-read')
  async markAllRead(@Request() req: any) {
    const userId = req.user.user_id;
    return this.svc.markAllRead(userId);
  }

  @Delete(':id')
  async delete(@Param('id') id: string, @Request() req: any) {
    const userId = req.user.user_id;
    return this.svc.deleteOne(userId, id);
  }
}


