import { Class } from '@travetto/registry';
import { Consumer } from '../model/consumer';

export class ConsumerRegistry {
  private static registered = new Map<string, Class<Consumer>>();
  private static primary: Class<Consumer>;

  static add(type: string, cls: Class<Consumer>, isDefault = false) {
    if (isDefault) {
      this.primary = cls;
    }
    this.registered.set(type, cls);
  }

  static get(type: string) {
    return this.registered.get(type);
  }

  static getOrDefault(type: string) {
    return this.get(type) ?? this.primary;
  }
}

export function Consumable(type: string, isDefault = false) {
  return function (cls: Class<Consumer>) {
    ConsumerRegistry.add(type, cls, isDefault);
  };
}