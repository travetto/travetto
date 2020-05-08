import { FsUtil } from '@travetto/boot';

/**
 * Utilities for templating
 */
export class TemplateUtil {

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
   * Wrap HTML tpl with the wrapper
   */
  static wrapWithBody(tpl: string, wrapper: string) {
    // Wrap template, with preamble/postamble
    return wrapper.replace('<!-- BODY -->', tpl);
  }

  /**
   * Resolve nested templates
   */
  static resolveNestedTemplates(template: string, templates: Record<string, string>) {
    return template.replace(/[{]{2}>\s+(\S+)\s*[}]{2}/g, (all: string, name: string): any => {
      name = FsUtil.toUnix(name);
      return this.resolveNestedTemplates(templates[name], templates);
    });
  }
}