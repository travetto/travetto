import { ResourceManager, FsUtil } from '@travetto/base';
import { Config } from '@travetto/config';

@Config('mail.template')
export class MailTemplateConfig {
  scssRoots: string[];

  async postConstruct() {
    ResourceManager.addPath(FsUtil.resolveURI(__dirname, '..', 'resources'));

    this.scssRoots = [
      ...ResourceManager.getPaths().map(x => FsUtil.resolveURI(x, 'email')),
      // Never assume direct access to node_modules
      require
        .resolve('foundation-emails/gulpfile.js')
        .replace('gulpfile.js', 'scss')
    ];
  }
}