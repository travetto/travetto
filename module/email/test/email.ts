import { Test, Suite, BeforeAll } from '@travetto/test';
import { EmailService } from '../src';
import { DependencyRegistry } from '@travetto/di';
import { RootRegistry } from '@travetto/registry';

import * as assert from 'assert';
import { TemplateEngine } from '../src/template';
import * as fs from 'fs';

@Suite('Emails')
class EmailSuite {

  @BeforeAll()
  async init() {
    await RootRegistry.init();
  }

  @Test('Should template properly')
  async templating() {
    const instance = await DependencyRegistry.getInstance(TemplateEngine);

    const out = await instance.template(`<row>
          <columns large="{{left}}">Bob</columns>
          <columns large="{{right}}"></columns>
        </row>`, { left: 6, right: 6 });
    assert(out.html.includes('>Bob</th>'));
    assert(out.html.includes('<meta name="viewport" content="width=device-width"'));
  }

  @Test('Should template images')
  async templatingImages() {
    const instance = await DependencyRegistry.getInstance(TemplateEngine);

    const out = await instance.template(`<img src="image/test.png">`, { left: 6, right: 6 });
    const img = await instance.getAssetBuffer('image/test.png');
    assert(img !== null);
    assert(img.length > 1000);
    assert(out.html.includes(img.toString('base64')));
  }

  @Test('Send email')
  async sendEmail() {
    const instance = await DependencyRegistry.getInstance(EmailService);

    const opts = await instance.sendEmail({
      to: 'tim@eaiti.com',
      subject: 'Simple Test',
      template: `<row>
            <columns large="6">{{name}}</columns>
            <columns large="6">{{price}}</columns>
          </row>`,
      context: { name: 'Tim', price: '100' }
    });
    assert((opts[0].html as string).includes('>100<'));
  }
}
