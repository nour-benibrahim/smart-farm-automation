import { Controller, Get, Param } from '@nestjs/common';
import { DeviceActionsService } from './device-actions.service';

@Controller('devices')
export class DeviceActionsController {
  constructor(private readonly deviceActionsService: DeviceActionsService) {}

  @Get(':deviceId/actions')
  async getDeviceActions(@Param('deviceId') deviceId: string) {
    return this.deviceActionsService.getDeviceActions(deviceId);
  }
}
