import * as assert from 'assert';

import { ResourceManager } from '@travetto/base';
import { RootRegistry } from '@travetto/registry';
import { Test, Suite, BeforeAll } from '@travetto/test';
import { DependencyRegistry, Injectable, InjectableFactory } from '@travetto/di';
import { NodemailerTransport, MailService } from '@travetto/email';

import { DefaultMailTemplateEngine } from '../';
import { MailTransport } from '@travetto/email/src/transport';


@Suite('Emails')
class EmailSuite {
  @InjectableFactory()
  static getTransport(): MailTransport {
    return new NodemailerTransport({
      host: 'smtp.gmail.com',
      port: 587,
      secure: false, // upgrade later with STARTTLS
      auth: {
        user: 'timothy.soehnlin@gmail.com',
        pass: 'ctgvgkoggxxyjazf'
      }
    } as any);
  }

  @BeforeAll()
  async init() {
    await RootRegistry.init();
    ResourceManager.addPath('e2e');
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

    const img = await instance.getImage('email/test.png');
    const out = await instance.template(`<img src="email/test.png">`, { left: 6, right: 6 });

    // Reworking to not send entire image for tests
    const hasImg = img !== null;

    assert(hasImg);
    assert(img.length > 900);

    const includesEncodedImage = out.html.includes(img.toString('base64'));
    assert(includesEncodedImage);
  }

  @Test('Should do a simple template', { timeout: 120000 })
  async simpleTemplate() {
    const template = `
  <spacer size="16"></spacer>
  
  <container class="body-drip">
    <row>
      <columns>
        <h3 class="text-center">
          <a href="google.com" class="noDecor">
             User sent you a message
          </a>
        </h3>
      </columns>
    </row>
  
    <row>
      <columns>
        <a href="" class="noDecor">
          <p>Hi firstName,</p>
          <p>
            You have a new message from User on OfferIn.
          </p>
          <a href="">Check it out!</a>
        </a>
        <spacer size="15"></spacer>
        <button class="button" href="https://google.com">Messages</button>
      </columns>
    </row>
  </container>`;
    const instance = await this.getEngine();
    const output = await instance.template(template);
    const svc = await DependencyRegistry.getInstance(MailService);
    await svc.send({
      ...output,
      to: 'timothy.soehnlin@gmail.com',
    });
  }
}
