import { promises as fs } from 'fs';

import { FsUtil } from '@travetto/boot';

import { Inky } from './inky';
import { MarkdownUtil } from './markdown';
import { StyleUtil } from './style';
import { ImageUtil } from './image';

export type MapLite<K, V> = {
  get(k: K): V | null;
  has(k: K): boolean;
};

/**
 * Utilities for templating
 */
export class TemplateUtil {

  static TPL_EXT = /[.]tpl[.]html$/;

  /**
   * Grab list of all avaliable templates
   */
  static async findAllTemplates() {
    const { ResourceManager } = await import('@travetto/base');

    return (await ResourceManager.findAllByPattern(this.TPL_EXT, 'email'))
      .sort()
      .map(path => ({
        path,
        key: path.replace(/^email\//, '').replace(this.TPL_EXT, '')
      }));
  }

  /**
   * Create email context via URL and template
   */
  static async buildContext(context: Record<string, any>, content: string, overrides: MapLite<string, string>) {

    const base: Record<string, any> = {
      ...context
    };

    content.replace(/[{]{2}\s*([A-Za-z0-9_.]+)\s*[}]{2}/g, (all, sub) => {
      if (!overrides.has(sub) || overrides.get(sub) === '') {
        base[sub] = all;
      } else {
        base[sub] = overrides.get(sub);
      }
      return '';
    });

    try {
      Object.assign(base, context);
    } catch (e) {
    }

    const { ConfigUtil } = await import('@travetto/config/src/internal/util');

    return ConfigUtil.breakDownKeys(base);
  }

  /**
   * Compile all to disk
   */
  static async compileAllToDisk() {
    const keys = await this.findAllTemplates();
    const all = keys.map(tpl => this.compileToDisk(tpl.path, true));
    await Promise.all(all);
    return all;
  }

  /**
   * Compile templates to disk
   */
  static async compileToDisk(key: string, force = false) {
    const { ResourceManager } = await import('@travetto/base');

    const tplFile = key.startsWith(process.cwd()) ? key : await ResourceManager.toAbsolutePath(key);
    const textFile = tplFile.replace(/[.]tpl[.]html$/, '.compiled.txt');
    const htmlFile = tplFile.replace(/[.]tpl[.]html$/, '.compiled.html');

    const resolved = await fs.readFile(tplFile, 'utf8');
    if (force || !(await FsUtil.exists(textFile)) || !(await FsUtil.exists(htmlFile))) {
      const compiled = await this.compile(resolved);
      await fs.writeFile(textFile, compiled.text, { encoding: 'utf8' });
      await fs.writeFile(htmlFile, compiled.html, { encoding: 'utf8' });
      return compiled;
    } else {
      return {
        text: await fs.readFile(textFile, 'utf8'),
        html: await fs.readFile(htmlFile, 'utf8')
      };
    }
  }

  /**
   * Compile template
   */
  static async compile(tpl: string) {
    const { ResourceManager } = await import('@travetto/base');
    const { DependencyRegistry } = await import('@travetto/di');
    const { MailTemplateEngine } = await import('@travetto/email');

    const engine = await DependencyRegistry.getInstance(MailTemplateEngine);

    // Wrap with body
    tpl = (await ResourceManager.read('email/wrapper.html', 'utf8')).replace('<!-- BODY -->', tpl);

    // Resolve mustache partials
    tpl = await engine.resolveNested(tpl);

    // Transform inky markup
    let html = Inky.render(tpl);

    // Apply styles
    html = await StyleUtil.applyStyling(html);

    // Inline Images
    html = await ImageUtil.inlineImageSource(html);

    // Generate text version
    const text = await MarkdownUtil.htmlToMarkdown(tpl);

    return { html, text };
  }

  /**
   * Watch compilation
   */
  static async watchCompile(cb?: (file: string) => void) {
    const { ResourceManager } = await import('@travetto/base');
    const { FilePresenceManager } = await import('@travetto/watch');

    new FilePresenceManager(ResourceManager.getRelativePaths().map(x => `${x}/email`), {
      ignoreInitial: true,
      validFile: x =>
        /[.](html|txt|scss|css|png|jpg|gif)$/.test(x) &&
        !/\/email\/.*[.](compiled|dev)[.]/.test(x)
    }).on('changed', ({ file: f }) => {
      console.log('Contents changed', f);
      this.compileToDisk(f, true).then(() => cb && cb(f));
    });
    await new Promise(r => setTimeout(r, 1000 * 60 * 60 * 24 * 1));
  }

  /**
   * Initialize for operation
   */
  static async initApp() {
    process.env.TRV_RESOURCE_ROOTS = [
      `${process.env.TRV_RESOURCE_ROOTS || ''}`,
      FsUtil.resolveUnix(__dirname, '..', '..'),
      __dirname
    ].join(',');
    const { PhaseManager, AppManifest } = await import('@travetto/base');
    await PhaseManager.init();
  }
}