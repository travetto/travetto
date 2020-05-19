import { Application } from '@travetto/app';
import { InjectableFactory } from '@travetto/di';
import { MailService, NodemailerTransport, MailTransport } from '../../..';
const sendmail = require('nodemailer-sendmail-transport');

class EmailConfig {
  @InjectableFactory()
  static getTransport(): MailTransport {
    return new NodemailerTransport(sendmail);
  }
}

@Application('sample')
export class Sample {
  constructor(private service: MailService) { }

  async run() {
    await this.service.send({
      to: 'timothy.soehnlin@gmail.com',
      subject: 'Test',
      html: 'hello world'
    });
  }
}