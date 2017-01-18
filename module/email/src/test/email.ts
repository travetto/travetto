import { EmailService } from '../lib';
import { expect } from 'chai';

describe('Emails', () => {
  it('Should template properly', async () => {
    let out = await EmailService.template(`<row>
      <columns large="{{left}}">Bob</columns>
      <columns large="{{right}}"></columns>
    </row>`, { left: 6, right: 6 });

    expect(out).to.include('>Bob</th>');
  });

  it('Send email', async () => {
    await EmailService.sendEmail({
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