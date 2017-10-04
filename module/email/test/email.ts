import { Test, Suite, BeforeAll } from '@travetto/test';
import { EmailService } from '../src';
import { DependencyRegistry } from '@travetto/di';
import { RootRegistry } from '@travetto/registry';

import * as assert from 'assert';

@Suite('Emails')
class EmailSuite {

  @BeforeAll()
  async init() {
    await RootRegistry.init();
  }

  @Test('Should template properly')
  async templating() {
    let instance = await DependencyRegistry.getInstance(EmailService);

    let out = await instance.template(`<row>
          <columns large="{{left}}">Bob</columns>
          <columns large="{{right}}"></columns>
        </row>`, { left: 6, right: 6 });
    assert(out.includes('>Bob</th>'))
  }

  @Test('Send email')
  async sendEmail() {
    let instance = await DependencyRegistry.getInstance(EmailService);

    await instance.sendEmail({
      to: 'tim@eaiti.com',
      subject: 'Simple Test',
      body: `<row>
            <columns large="6">{{name}}</columns>
            <columns large="6">{{price}}</columns>
          </row>`,
      context: { name: 'Tim', price: '100' }
    });

  }
}
