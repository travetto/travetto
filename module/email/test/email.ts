import assert from 'node:assert';

import { Test, Suite } from '@travetto/test';
import { Inject, InjectableFactory } from '@travetto/di';
import { MailTransport, MailService, NullTransport } from '@travetto/email';

import { InjectableSuite } from '@travetto/di/support/test/suite.ts';

class Config {
  @InjectableFactory()
  static getTransport(): MailTransport {
    return new NullTransport();
  }
}

@Suite('Emails')
@InjectableSuite()
class EmailSuite {

  @Inject()
  instance: MailService;

  @Test('Send email')
  async sendEmail() {
    const opts = await this.instance.send({
      subject: 'Hello',
      html: 'Message'
    });
    assert(opts);
  }
}
