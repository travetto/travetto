import assert from 'node:assert';

import { Test, Suite } from '@travetto/test';
import { Inject, InjectableFactory } from '@travetto/di';
import { InjectableSuite } from '@travetto/di/support/test/suite.ts';

import { MailService } from '../src/service.ts';
import { MailTransport, NullTransport } from '../src/transport.ts';

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
