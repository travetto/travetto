import { Config } from '@travetto/config';
import * as path from 'path';

@Config('mail')
export class MailConfig {
  transport = 'sendmail';
  defaults = {
    title: 'Email Title',
    from: 'Travetto Mailer <mailer@travetto.org>',
    replyTo: 'Travetto Mailer <mailer@travetto.org>',
  };
  inky = {};

  postConstruct() {
    console.log(this);
  }
}

@Config('mail.template')
export class MailTemplateConfig {
  assetRoot = `${__dirname}/../assets`;

  scssRoot = `${this.assetRoot}/scss`;

  async postConstruct() {
  }
}