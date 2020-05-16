import { Class } from '@travetto/registry';
import { TestConsumer } from '../model/consumer';

export class TestConsumerRegistry {
  private static registered = new Map<string, Class<TestConsumer>>();
  private static primary: Class<TestConsumer>;

  static add(type: string, cls: Class<TestConsumer>, isDefault = false) {
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
  return function (cls: Class<TestConsumer>) {
    TestConsumerRegistry.add(type, cls, isDefault);
  };
}