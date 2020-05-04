import { FsUtil } from '@travetto/boot';
import { ResourceManager } from '@travetto/base';
import { Config } from '@travetto/config';

/**
 * Simple mail template config
 */
@Config('mail.template')
export class MailTemplateConfig {

  /**
   * Additional folders to read SCSS files from
   */
  scssRoots: string[];

  async postConstruct() {
    ResourceManager.addPath(FsUtil.resolveUnix(__dirname, '..'));

    this.scssRoots = [
      ...ResourceManager.getPaths().map(x => FsUtil.resolveUnix(x, 'email')),
      // Never assume direct access to node_modules
      require
        .resolve('foundation-emails/gulpfile.js')
        .replace('gulpfile.js', 'scss') // Include foundation-emails as part of available roots
    ];
  }
}