import { Application } from '@travetto/app';
import { InjectableFactory } from '@travetto/di';
import { MailService, MailTransport } from '@travetto/email';

import { NodemailerTransport } from '..';

class EmailConfig {
  @InjectableFactory()
  static getTransport(): MailTransport {
    return new NodemailerTransport({ sendmail: true });
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