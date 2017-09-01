import 'mocha';

import { EmailService } from '../src';
import { expect } from 'chai';
import { Registry } from '@encore/di';

describe('Emails', () => {
  it('Should template properly', async () => {
    let instance = await Registry.getInstance(EmailService);

    let out = await instance.template(`<row>
      <columns large="{{left}}">Bob</columns>
      <columns large="{{right}}"></columns>
    </row>`, { left: 6, right: 6 });

    expect(out).to.include('>Bob</th>');
  });

  it('Send email', async () => {
    let instance = await Registry.getInstance(EmailService);

    await instance.sendEmail({
      to: 'tim@eaiti.com',
      subject: 'Simple Test',
      body: `<row>
        <columns large="6">{{name}}</columns>
        <columns large="6">{{price}}</columns>
      </row>`,
      context: { name: 'Tim', price: '100' }
    });
  });
});