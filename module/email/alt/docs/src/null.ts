import { InjectableFactory } from '@travetto/di';
import { NullTransport } from '../../../src/transport';

class Config {
  @InjectableFactory()
  static getTransport() {
    return new NullTransport();
  }
}