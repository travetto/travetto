import { ResourceManager, FsUtil } from '@travetto/base';
import { Config } from '@travetto/config';

@Config('mail.template')
export class MailTemplateConfig {
  scssRoots: string[];

  async postConstruct() {
    ResourceManager.addPath(FsUtil.resolveUnix(__dirname, '../resources'));

    this.scssRoots = [
      ...ResourceManager.getPaths().map(x => FsUtil.resolveUnix(x, 'email')),
      // Never assume direct access to node_modules
      require
        .resolve('foundation-emails/gulpfile.js')
        .replace('gulpfile.js', 'scss')
    ];
  }
}