import * as path from 'path';

import { Env, FsUtil } from '@travetto/base';
import { Config } from '@travetto/config';

@Config('mail.template')
export class MailTemplateConfig {
  private _cache: { [key: string]: string } = {};

  assetRoots: string[] = [];
  scssRoots: string[];

  async postConstruct() {
    this.assetRoots.push(...[Env.cwd, path.resolve(__dirname, '..')]);

    if (Env.e2e) {
      this.assetRoots.push(path.resolve(__dirname, '..', 'e2e'));
    }

    this.assetRoots = this.assetRoots.map(x => path.join(x, 'assets'));

    this.scssRoots = [
      ...this.assetRoots.map(x => path.join(x, 'scss')),
      // Never assume direct access to node_modules
      require.resolve('foundation-emails/gulpfile.js').replace('gulpfile.js', 'scss')];
  }

  async findFirst(pth: string) {
    pth = pth.replace(/[\/]+/g, path.sep);

    if (pth in this._cache) {
      return this._cache[pth];
    }

    for (const f of this.assetRoots.map(x => path.join(x, pth))) {
      if (await FsUtil.existsAsync(f)) {
        return this._cache[pth] = f;
      }
    }

    throw new Error('Not found');
  }
}