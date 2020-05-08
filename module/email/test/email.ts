import * as assert from 'assert';

import { RootRegistry } from '@travetto/registry';
import { Test, Suite, BeforeAll } from '@travetto/test';
import { DependencyRegistry, InjectableFactory } from '@travetto/di';

import { MailService, MailTransport, NullTransport } from '../';

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
  }

  @Test('Send email')
  async sendEmail() {
    const instance = await DependencyRegistry.getInstance(MailService);

    const opts = await instance.send({
      html: 'Message'
    });
    assert(opts);
  }
}
