import * as assert from 'assert';

import { Test, Suite, BeforeAll } from '@travetto/test';
import { DependencyRegistry } from '@travetto/di';
import { RootRegistry } from '@travetto/registry';
import { MailTemplateEngine } from '@travetto/email';

import { DefaultMailTemplateEngine } from '../';

// Must force import
require('../src/template');

@Suite('Emails')
class EmailSuite {

  @BeforeAll()
  async init() {
    await RootRegistry.init();
    await DependencyRegistry.init();
  }

  async getEngine() {
    return await DependencyRegistry.getInstance(MailTemplateEngine);
  }

  @Test('Should template properly')
  async templating() {
    const instance = await this.getEngine();

    const out = await instance.template(`<row>
          <columns large="{{left}}">Bob</columns>
          <columns large="{{right}}"></columns>
        </row>`, { left: 6, right: 6 });

    assert(out.html.includes('>Bob</th>'));
    assert(out.html.includes('<meta name="viewport" content="width=device-width"'));
  }

  @Test('Should template images')
  async templatingImages() {
    const instance = (await this.getEngine()) as DefaultMailTemplateEngine;

    const out = await instance.template(`<img src="image/test.png">`, { left: 6, right: 6 });
    const img = await instance.getAssetBuffer('image/test.png');
    assert(img !== null);
    assert(img.length > 1001);
    assert(out.html.includes(img.toString('base64')));
  }
}
