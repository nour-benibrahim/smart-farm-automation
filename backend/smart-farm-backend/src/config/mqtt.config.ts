import { ConfigService } from '@nestjs/config';

export const mqttConfig = (configService: ConfigService) => ({
  url: configService.get('MQTT_BROKER'),
  username: configService.get('MQTT_USERNAME'),  // was: MQTT_USER (mismatch fixed)
  password: configService.get('MQTT_PASSWORD'),  // was: MQTT_PASS (mismatch fixed)
});
