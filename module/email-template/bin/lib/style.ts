import * as inlineCss from 'inline-css';

import { ResourceManager } from '@travetto/base';
import { FsUtil, EnvUtil } from '@travetto/boot';


/**
 * Style Utils
 */
export class StyleUtil {
  private static defaultTemplateWidth = EnvUtil.getInt('EMAIL_WIDTH', 580);

  /**
   * Compile SCSS content with roots as search paths for additional assets
   */
  static async compileSass(file: string, roots: string[]) {
    return new Promise<string>((resolve, reject) => {
      const sass = require('sass') as { render(args: any, cb: (err: any, results: { css: string | Buffer }) => void): void };
      sass.render({
        file,
        sourceMap: false,
        includePaths: roots
      }, (err, res) => {
        if (err) {
          reject(err);
        } else {
          const css = res.css.toString();
          resolve(css);
        }
      });
    });
  }


  /**
   * Get compiled styles
   */
  static async getStyles() {
    const partial = '/email/app.scss';
    const file = await ResourceManager.find(partial);
    return await this.compileSass(file, [
      require
        .resolve('foundation-emails/gulpfile.js')
        .replace('gulpfile.js', 'scss'), // Include foundation-emails as part of available roots
      ...ResourceManager.getPaths().map(x => FsUtil.resolveUnix(x, 'email')),
    ]);
  }

  /**
   * Apply styling to html
   * @param html
   */
  static async applyStyling(html: string) {
    const css = await this.getStyles();
    const styles = [`<style type="text/css">\n${css}\n</style>`];

    html = html.replace(/<style[^>]*>([\s\S]*?)<\/style>/g, (all) => {
      styles.push(all);
      return '';
    });

    // Macro support
    html = html
      .replace(/<\/head>/, all => `${styles.join('\n')}\n${all}`)
      .replace(/%EMAIL_WIDTH%/g, `${this.defaultTemplateWidth}`);

    // Inline css
    html = (await inlineCss(html, {
      url: 'https://google.com',
      preserveMediaQueries: true,
      removeStyleTags: true,
      applyStyleTags: true
    }));

    return html;
  }
}