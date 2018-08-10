import * as assert from 'assert';

import { DependencyRegistry } from '@travetto/di';
import { Test, Suite, BeforeAll } from '@travetto/test';

import { TemplateEngine } from '@travetto/email/src/template';

import { EmailService } from '../../src/service/email';

const body = `<style>
  strong { color: orange }
</style>
<strong>{{name}}</strong>`;

const context = { name: 'Brad' };

@Suite('Email Service')
class EmailServiceTest {
  @BeforeAll()
  async init() {
    await DependencyRegistry.init();
  }

  @Test('Verify Templating')
  async templating() {
    const tplr = await DependencyRegistry.getInstance(TemplateEngine);
    const result = (await tplr.template(body, context)).html;

    assert(/<strong style="color: orange;">\s*Brad\s*<\/strong>/.test(result));
  }

  @Test('Send email')
  async sendEmail() {
    const service = await DependencyRegistry.getInstance(EmailService);
    await service.sendEmail([], { to: 'tim@eaiti.com', subject: 'Test', template: body, context });
    assert(true);
  }
}