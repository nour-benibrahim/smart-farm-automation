import { OnEvent } from '@nestjs/event-emitter';
import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server } from 'socket.io';
import { Logger } from '@nestjs/common';
import { Notification } from '../../entities/notification.entity';

@WebSocketGateway({ 
  cors: { 
    origin: [/^http:\/\/localhost:\d+$/, /^https:\/\/.*\.up\.railway\.app$/],
    credentials: true 
  } 
})
export class NotificationsGateway {
  private readonly logger = new Logger(NotificationsGateway.name);

  @WebSocketServer()
  server: Server;

  @OnEvent('notification.created')
  handleCreated(notification: Notification) {
    this.logger.log(`📡 [WEBSOCKET] Broadcasting notification: ${notification.id} - ${notification.title}`);
    // Broadcast to all clients; client can filter by user_id
    this.server.emit('notification.created', notification);
  }

  @OnEvent('action.acknowledged')
  handleActionAcknowledged(data: any) {
    this.logger.log(`📡 [WEBSOCKET] Broadcasting action acknowledged: ${data.actionId}`);
    this.server.emit('action.acknowledged', data);
  }

  @OnEvent('action.failed')
  handleActionFailed(data: any) {
    this.logger.log(`📡 [WEBSOCKET] Broadcasting action failed: ${data.actionId}`);
    this.server.emit('action.failed', data);
  }

  @OnEvent('action.timeout')
  handleActionTimeout(data: any) {
    this.logger.log(`📡 [WEBSOCKET] Broadcasting action timeout: ${data.actionId}`);
    this.server.emit('action.timeout', data);
  }

  @OnEvent('action.executed')
  handleActionExecuted(data: any) {
    this.logger.log(`📡 [WEBSOCKET] Broadcasting action executed: ${data.action}`);
    this.server.emit('action.executed', data);
  }

  @OnEvent('device.status')
  handleDeviceStatus(data: any) {
    this.logger.debug(`📡 [WEBSOCKET] Broadcasting device status: ${data.deviceId} - ${data.status}`);
    this.server.emit('device.status', data);
  }
}


