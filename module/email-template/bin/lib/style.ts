import * as util from 'util';

/**
 * Style Utils
 */
export class StyleUtil {

  /**
   * Compile SCSS content with roots as search paths for additional assets
   */
  static async compileSass(file: string, roots: string[]) {
    const sass = await import('sass');
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

    const file = await ResourceManager.find('email/main.scss');
    return await this.compileSass(file, [
      require
        .resolve('foundation-emails/gulpfile.js')
        .replace('gulpfile.js', 'scss'), // Include foundation-emails as part of available roots
      ...ResourceManager.getPaths().map(x => `${x}/email`)
    ]);
  }

  /**
   * Apply styling to html
   * @param html
   */
  static async applyStyling(html: string) {
    // Inline css
    const inlineCss = await import('inline-css');
    html = (await inlineCss(html, {
      url: 'https://app.dev',
      preserveMediaQueries: true,
      removeStyleTags: true,
      removeLinkTags: true,
      applyStyleTags: true,
      extraCss: await this.getStyles()
    }));

    return html;
  }
}