import { Application, InjectableFactory } from '@travetto/di';
import { EmailService } from '../../src/email';
import { NodemailerTransport } from '../../extension/nodemailer';
import { MailTransport } from '../../src/transport';
const sendmail = require('nodemailer-sendmail-transport');

class EmailConfig {
  @InjectableFactory()
  static getTransport(): MailTransport {
    return new NodemailerTransport(sendmail);
  }
}

@Application('sample')
export class Sample {
  constructor(private service: EmailService) { }

  async run() {
    await this.service.sendEmail({
      to: 'timothy.soehnlin@gmail.com',
      subject: 'Test',
      html: 'hello world'
    });
  }
}