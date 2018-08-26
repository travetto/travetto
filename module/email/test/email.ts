import * as assert from 'assert';

import { Test, Suite, BeforeAll } from '@travetto/test';
import { DependencyRegistry, InjectableFactory } from '@travetto/di';
import { RootRegistry } from '@travetto/registry';

import { EmailService, MailTransport, NullTransport } from '../src';

class Config {
  @InjectableFactory()
  static getTransport(): MailTransport {
    return new NullTransport();
  }
}

@Suite('Emails')
class EmailSuite {

  @BeforeAll()
  async init() {
    await RootRegistry.init();
    await DependencyRegistry.init();
  }

  @Test('Send email')
  async sendEmail() {
    const instance = await DependencyRegistry.getInstance(EmailService);

    const opts = await instance.sendEmail({});
    assert(opts);
  }
}
