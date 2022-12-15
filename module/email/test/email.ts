import assert from 'assert';

import { Test, Suite } from '@travetto/test';
import { Inject, InjectableFactory } from '@travetto/di';
import { InjectableSuite } from '@travetto/di/support/test/suite';

import { MailService, MailTransport, NullTransport } from '../index';

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
      html: 'Message'
    });
    assert(opts);
  }
}
