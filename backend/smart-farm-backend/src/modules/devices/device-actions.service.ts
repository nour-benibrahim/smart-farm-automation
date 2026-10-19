import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Sensor } from '../../entities/sensor.entity';

export interface DeviceAction {
  id: string;
  name: string;
  description: string;
  icon: string;
  actionUri: string;
  actionType: 'critical' | 'important' | 'normal';
  category: string;
  sensorType: string;
  triggerType: 'low' | 'high';
}

@Injectable()
export class DeviceActionsService {
  constructor(
    @InjectRepository(Sensor)
    private readonly sensorRepo: Repository<Sensor>,
  ) {}

  async getDeviceActions(deviceId: string): Promise<DeviceAction[]> {
    // Get all sensors for this device
    const sensors = await this.sensorRepo.find({
      where: { device_id: deviceId }
    });

    const actions: DeviceAction[] = [];

    for (const sensor of sensors) {
      // Add action_low if exists
      if (sensor.action_low) {
        const action = this.parseAction(sensor, sensor.action_low, 'low');
        if (action) actions.push(action);
      }

      // Add action_high if exists
      if (sensor.action_high) {
        const action = this.parseAction(sensor, sensor.action_high, 'high');
        if (action) actions.push(action);
      }
    }

    return actions;
  }

  private parseAction(sensor: Sensor, actionUri: string, triggerType: 'low' | 'high'): DeviceAction | null {
    try {
      // Extract action name from URI: mqtt:smartfarm/actuators/dht11H/ventilator_on -> ventilator_on
      const actionName = actionUri.split('/').pop();
      if (!actionName) return null;

      // Generate action details
      const action: DeviceAction = {
        id: `${sensor.sensor_id}_${sensor.type}_${triggerType}_${actionName}`,
        name: this.generateActionName(actionName, sensor.type, triggerType),
        description: this.generateActionDescription(actionName, sensor.type, triggerType),
        icon: this.getActionIcon(actionName),
        actionUri: actionUri,
        actionType: this.getActionType(actionName),
        category: this.getActionCategory(actionName),
        sensorType: sensor.type,
        triggerType: triggerType
      };

      return action;
    } catch (error) {
      console.error(`Error parsing action: ${actionUri}`, error);
      return null;
    }
  }

  private generateActionName(actionName: string, sensorType: string, triggerType: 'low' | 'high'): string {
    // Convert snake_case to Title Case
    const formatted = actionName
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');

    // Add context based on sensor type and trigger
    const context = triggerType === 'low' ? 'Low' : 'High';
    return `${formatted} (${sensorType} ${context})`;
  }

  private generateActionDescription(actionName: string, sensorType: string, triggerType: 'low' | 'high'): string {
    const trigger = triggerType === 'low' ? 'low' : 'high';
    const action = actionName.replace(/_/g, ' ');
    return `Execute ${action} when ${sensorType} is ${trigger}`;
  }

  private getActionIcon(actionName: string): string {
    const name = actionName.toLowerCase();
    
    // Ventilation
    if (name.includes('ventilator') || name.includes('fan')) return 'air';
    
    // Water/Irrigation
    if (name.includes('water') || name.includes('pump') || name.includes('irrigation')) return 'water_drop';
    
    // Humidity
    if (name.includes('humidifier')) return 'humidity_percentage';
    
    // Roof/Structure
    if (name.includes('roof')) return name.includes('open') ? 'open_in_full' : 'close_fullscreen';
    
    // Lighting
    if (name.includes('light')) return name.includes('on') ? 'lightbulb' : 'lightbulb_outline';
    
    // Heating
    if (name.includes('heater') || name.includes('heat')) return 'local_fire_department';
    
    // Default
    return 'smart_toy';
  }

  private getActionType(actionName: string): 'critical' | 'important' | 'normal' {
    const name = actionName.toLowerCase();
    
    // Critical actions
    if (name.includes('pump') || name.includes('irrigation') || name.includes('heater') || name.includes('roof')) {
      return 'critical';
    }
    
    // Important actions
    if (name.includes('ventilator') || name.includes('fan') || name.includes('humidifier')) {
      return 'important';
    }
    
    // Normal actions
    return 'normal';
  }

  private getActionCategory(actionName: string): string {
    const name = actionName.toLowerCase();
    
    if (name.includes('water') || name.includes('pump') || name.includes('irrigation')) return 'irrigation';
    if (name.includes('ventilator') || name.includes('fan')) return 'ventilation';
    if (name.includes('humidifier')) return 'humidity';
    if (name.includes('roof')) return 'structure';
    if (name.includes('light')) return 'lighting';
    if (name.includes('heater') || name.includes('heat')) return 'heating';
    
    return 'system';
  }
}
