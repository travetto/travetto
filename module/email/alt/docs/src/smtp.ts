import { NodemailerTransport } from '../../..';
import { InjectableFactory } from '@travetto/di';

class Config {
  @InjectableFactory()
  static getTransport() {
    return new NodemailerTransport(require('nodemailer-smtp-transport'));
  }
}