import { InjectableFactory } from '@travetto/di';
import { NodemailerTransport } from '@travetto/email-nodemailer';

class Config {
  @InjectableFactory()
  static getTransport() {
    return new NodemailerTransport({ sendmail: true });
  }
}
