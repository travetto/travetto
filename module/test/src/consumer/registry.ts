import { Class } from '@travetto/registry';
import { Consumer } from '../model/consumer';

export class ConsumerRegistry {
  private static registered = new Map<string, Class<Consumer>>();
  private static _default: Class<Consumer>;

  static add(type: string, cls: Class<Consumer>, isDefault = false) {
    if (isDefault) {
      this._default = cls;
    }
    this.registered.set(type, cls);
  }

  static get(type: string) {
    return this.registered.get(type);
  }

  static getOrDefault(type: string) {
    return this.get(type) ?? this._default;
  }
}

export function Consumable(type: string, isDefault = false) {
  return function (cls: Class<Consumer>) {
    ConsumerRegistry.add(type, cls, isDefault);
  };
}