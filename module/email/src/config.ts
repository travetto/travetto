import * as path from 'path';
import * as fs from 'fs';
import * as util from 'util';
import { AppEnv } from '@travetto/base';
import { Config } from '@travetto/config';

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
    console.debug(this);
  }
}

@Config('mail.template')
export class MailTemplateConfig {
  private _cache: { [key: string]: string } = {};

  assetRoots: string[] = [];
  scssRoots: string[];

  async postConstruct() {
    this.assetRoots.push(...[AppEnv.cwd, path.resolve(path.join(__dirname, '..'))]
      .map(x => path.join(x, 'assets', 'email')));
    this.scssRoots = [
      ...this.assetRoots.map(x => path.join(x, 'scss')),
      path.join(AppEnv.cwd, 'node_modules', 'foundation-emails', 'scss')];
  }

  async findFirst(pth: string) {
    pth = pth.replace(/[\/]+/g, path.sep);

    if (pth in this._cache) {
      return this._cache[pth];
    }

    for (const f of this.assetRoots.map(x => path.join(x, pth))) {
      if (await exists(f)) {
        return this._cache[pth] = f;
      }
    }

    throw new Error('Not found');
  }
}