import * as assert from 'assert';

import { Test, Suite, BeforeAll } from '@travetto/test';
import { DependencyRegistry } from '@travetto/di';
import { RootRegistry } from '@travetto/registry';

import { DefaultMailTemplateEngine } from '../';
import { ResourceManager } from '@travetto/base';

@Suite('Emails')
class EmailSuite {

  @BeforeAll()
  async init() {
    await RootRegistry.init();
    await DependencyRegistry.init();
    ResourceManager.addPath('e2e/resources');
  }

  async getEngine() {
    return await DependencyRegistry.getInstance(DefaultMailTemplateEngine);
  }

  @Test('Should template properly')
  async templating() {
    const instance = await this.getEngine();

    const out = await instance.template(`<row>
          <columns large="{{left}}">Bob</columns>
          <columns large="{{right}}"></columns>
        </row>`, { left: 6, right: 6 });

    const hasBob = out.html.includes('>Bob</th>');
    assert(hasBob);
    const hasMeta = out.html.includes('<meta name="viewport" content="width=device-width"');
    assert(hasMeta);
  }

  @Test('Should template images')
  async templatingImages() {
    const instance = (await this.getEngine()) as DefaultMailTemplateEngine;

    const out = await instance.template(`<img src="email/test.png">`, { left: 6, right: 6 });
    const img = await instance.getImage('email/test.png');

    // Reworking to not send entire image for tests
    const hasImg = img !== null;

    assert(hasImg);
    assert(img.length > 900);

    const includesEncodedImage = out.html.includes(img.toString('base64'));
    assert(includesEncodedImage);
  }
}
