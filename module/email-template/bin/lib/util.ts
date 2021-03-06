import { dirname } from 'path';
import { promises as fs } from 'fs';

import { FsUtil } from '@travetto/boot';
import type { MailTemplateEngine } from '@travetto/email';

import { Inky } from './inky';
import { MarkdownUtil } from './markdown';
import { StyleUtil } from './style';
import { ImageUtil } from './image';

type Parts = 'html' | 'text' | 'subject';
const PARTS = (['html', 'subject', 'text'] as const);

/**
 * Utilities for templating
 */
export class TemplateUtil {

  static TPL_EXT = /[.]email[.]html$/;

  static getOutputs(file: string) {
    return PARTS.map(k => [k, file.replace(this.TPL_EXT, `.compiled.${k}`)] as [part: Parts, file: string]);
  }

  /**
   * Grab list of all avaliable templates
   */
  static async findAllTemplates() {
    const { ResourceManager } = await import('@travetto/base');

    return Promise.all((await ResourceManager.findAll(this.TPL_EXT))
      .sort()
      .map(async path => ({
        path: await ResourceManager.findAbsolute(path),
        key: path.replace(this.TPL_EXT, '')
      })));
  }

  /**
   * Compile all to disk
   */
  static async compileAllToDisk() {
    const keys = await this.findAllTemplates();
    return Promise.all(keys.map(tpl => this.compileToDisk(tpl.path)));
  }

  /**
   * Compile templates to disk
   */
  static async compileToDisk(file: string) {
    const resolved = await fs.readFile(file, 'utf8');
    const compiled = await this.compile(resolved, dirname(file));

    await Promise.all(this.getOutputs(file)
      .map(([k, f]) => {
        if (compiled[k]) {
          return fs.writeFile(f, compiled[k], { encoding: 'utf8' });
        } else {
          return fs.unlink(f).catch(() => { }); // Remove file if data not provided
        }
      }));

    return compiled;
  }

  /**
   * Compile template
   */
  static async compile(tpl: string, root: string) {
    const { ResourceManager } = await import('@travetto/base');
    const { DependencyRegistry } = await import('@travetto/di');
    const { MailTemplateEngineTarget } = await import('@travetto/email/src/internal/types');

    const engine = await DependencyRegistry.getInstance<MailTemplateEngine>(MailTemplateEngineTarget);

    // Wrap with body
    tpl = (await ResourceManager.read('email/wrapper.html', 'utf8')).replace('<!-- BODY -->', tpl);

    // Resolve mustache partials
    tpl = await engine.resolveNested(tpl);

    // Transform inky markup
    let html = Inky.render(tpl);

    // Get Subject
    const [, subject] = html.match(/<title>(.*?)<\/title>/) ?? [];

    // Apply styles
    html = await StyleUtil.applyStyling(html);

    // Inline Images
    html = await ImageUtil.inlineImageSource(html, root);

    // Generate text version
    const text = await MarkdownUtil.htmlToMarkdown(tpl);

    return { html, text, subject };
  }

  /**
   * Resolve template
   */
  static async resolveTemplate(file: string, format: Parts, context: Record<string, unknown>) {

    const files = this.getOutputs(file);
    const missing = await Promise.all(files.map(x => FsUtil.exists(x[1])));

    if (missing.some(x => x === undefined)) {
      await this.compileToDisk(file);
    }

    const compiled = Object.fromEntries(await Promise.all(files.map(([k, f]) => fs.readFile(f, 'utf8').then(c => [k, c]))));

    // Let the engine template
    const { MailTemplateEngineTarget } = await import('@travetto/email/src/internal/types');
    const { DependencyRegistry } = await import('@travetto/di');

    const engine = await DependencyRegistry.getInstance<MailTemplateEngine>(MailTemplateEngineTarget);
    return engine.template(compiled[format], context);
  }

  /**
   * Render
   * @param file
   */
  static async resolveCompiledTemplate(file: string, context: Record<string, unknown>) {
    return Object.fromEntries(
      await Promise.all(
        PARTS.map(k =>
          this.resolveTemplate(file, k, context)
            .then(c => [k, c] as const)
        )
      )
    );
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
        !/[.]compiled[.]/.test(x) && (
          /[.](html|scss|css|png|jpe?g|gif|yml)$/.test(x)
        )
    }).on('changed', async ({ file }) => {
      console.log('Contents changed', { file });
      if (this.TPL_EXT.test(file)) {
        await this.compileToDisk(file);
        if (cb) {
          cb(file);
        }
      } else {
        await this.compileAllToDisk();
        if (cb) {
          for (const el of await this.findAllTemplates()) {
            cb(el.path);
          }
        }
      }
    });
    await new Promise(r => setTimeout(r, 1000 * 60 * 60 * 24 * 1));
  }
}