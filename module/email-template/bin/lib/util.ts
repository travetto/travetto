import * as fs from 'fs';
import * as util from 'util';

import { FsUtil, ScanFs } from '@travetto/boot';

import { Inky } from './inky';
import { MarkdownUtil } from './markdown';
import { StyleUtil } from './style';
import { ImageUtil } from './image';
import { ScanApp } from '@travetto/base';

const fsWriteFile = util.promisify(fs.writeFile);
const fsReadFile = util.promisify(fs.readFile);

export type MapLite<K, V> = {
  get(k: K): V | null;
  has(k: K): boolean;
};

/**
 * Utilities for templating
 */
export class TemplateUtil {

  static TPL_EXT = /[.]tpl[.]html$/;

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

    const resolved = await fsReadFile(tplFile, 'utf8');
    if (force || !(await FsUtil.exists(textFile)) || !(await FsUtil.exists(htmlFile))) {
      const compiled = await this.compile(resolved);
      await fsWriteFile(textFile, compiled.text, { encoding: 'utf8' });
      await fsWriteFile(htmlFile, compiled.html, { encoding: 'utf8' });
      return compiled;
    } else {
      return {
        text: await fsReadFile(textFile, 'utf8'),
        html: await fsReadFile(htmlFile, 'utf8')
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

    const ext = /[.](html|txt|scss|css|png|jpg|gif)$/;

    const watcher = new FilePresenceManager({
      cwd: FsUtil.cwd,
      validFile: x => ext.test(x),
      folders: ResourceManager.getRelativePaths().map(x => `${x}/email`),  // Email folders only
      files: ResourceManager.findAllByPatternSync(ext, 'email'),
      listener: {
        changed: async f => {
          if (/\/email\/.*[.](compiled|dev)[.]/.test(f)) {
            return;
          }
          console.log('Contents changed', f);
          await this.compileToDisk(f, true);
          if (cb) {
            cb(f);
          }
        }
      }
    });
    watcher.init();
    await new Promise(r => setTimeout(r, 1000 * 60 * 60 * 24 * 1));
  }
}