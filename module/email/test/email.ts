import * as assert from 'assert';

import { Test, Suite } from '@travetto/test';
import { Inject, InjectableFactory } from '@travetto/di';
import { BaseInjectableTest } from '@travetto/di/test-support/base';

import { MailService, MailTransport, NullTransport } from '../';

class Config {
  @InjectableFactory()
  static getTransport(): MailTransport {
    return new NullTransport();
  }
}

@Suite('Emails')
class EmailSuite extends BaseInjectableTest {

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
