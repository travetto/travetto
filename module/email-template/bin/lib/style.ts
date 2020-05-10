import * as util from 'util';
import { FsUtil } from '@travetto/boot';

/**
 * Style Utils
 */
export class StyleUtil {

  /**
   * Compile SCSS content with roots as search paths for additional assets
   */
  static async compileSass(file: string, roots: string[]) {
    const sass = await import('node-sass');
    const result = await util.promisify(sass.render)({
      file,
      sourceMap: false,
      includePaths: roots
    });
    return result.css.toString();
  }


  /**
   * Get compiled styles
   */
  static async getStyles() {
    const { ResourceManager } = await import('@travetto/base');

    const file = await ResourceManager.find('email/app.scss');
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
      .replace(/<\/head>/, all => `${styles.join('\n')}\n${all}`);

    // Inline css
    const inlineCss = await import('inline-css');
    html = (await inlineCss(html, {
      url: 'https://app.dev',
      preserveMediaQueries: true,
      removeStyleTags: true,
      applyStyleTags: true
    }));

    return html;
  }
}