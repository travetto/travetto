import { Config } from '@travetto/config';
import { InjectableFactory } from '@travetto/di';
import { NodemailerTransport } from '@travetto/email-nodemailer';

@Config('email.nodemailer')
export class NodemailerSmtpConfig {
  host: string = 'smtp.sendgrid.net';
  port: number = 587;
  secure: boolean = false;
  username?: string = 'apikey';
  password?: string;
}

export class NodemailerTransportFactory {
  @InjectableFactory()
  static createSmtpTransport(config: NodemailerSmtpConfig): NodemailerTransport {
    return new NodemailerTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: config.password ? { user: config.username, pass: config.password } : undefined
    });
  }
}
