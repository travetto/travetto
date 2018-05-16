import { Config } from '@travetto/config';
import * as path from 'path';
import * as fs from 'fs';
import * as util from 'util';

const exists = util.promisify(fs.exists);

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
  assetRoots: string[] = [];
  scssRoots: string[];

  async postConstruct() {
    this.assetRoots.push(...[process.cwd(), path.resolve(`${__dirname}/..`)].map(x => `${x}/assets/email`));
    this.scssRoots = [
      ...this.assetRoots.map(x => `${x}/scss`),
      `${process.cwd()}/node_modules/foundation-emails/scss`];
  }

  async findFirst(pth: string) {
    for (const f of this.assetRoots.map(x => `${x}/${pth}`)) {
      if (await exists(f)) {
        return f;
      }
    }
    throw new Error('Not found');
  }
}