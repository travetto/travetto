import { InjectableFactory } from '@travetto/di';
import { NullTransport } from '@travetto/email';

class Config {
  @InjectableFactory()
  static getTransport() {
    return new NullTransport();
  }
}