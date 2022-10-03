import { dirname } from 'path';
import { promises as fs } from 'fs';

import type { MailTemplateEngine } from '@travetto/email';

import { Inky } from './inky';
import { MarkdownUtil } from './markdown';
import { StyleUtil } from './style';
import { ImageUtil } from './image';

export const COMPILE_PARTS = ['html', 'subject', 'text'] as const;
export type CompileParts = (typeof COMPILE_PARTS)[number];

type Compilation = { html: string, text: string, subject?: string };

/**
 * Utilities for templating
 */
export class CompileUtil {

  static TPL_EXT = /[.]email[.]html$/;

  static getOutputs(file: string): [CompileParts, string][] {
    return COMPILE_PARTS.map((k): [part: CompileParts, file: string] => [k, file.replace(this.TPL_EXT, `.compiled.${k}`)]);
  }

  /**
   * Grab list of all available templates
   */
  static async findAllTemplates(): Promise<{ path: string, key: string }[]> {
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
  static async compileAllToDisk(): Promise<Compilation[]> {
    const keys = await this.findAllTemplates();
    return Promise.all(keys.map(tpl => this.compileToDisk(tpl.path)));
  }

  /**
   * Compile templates to disk
   */
  static async compileToDisk(file: string): Promise<Compilation> {
    const resolved = await fs.readFile(file, 'utf8');
    const compiled = await this.compile(resolved, dirname(file));

    await Promise.all(this.getOutputs(file)
      .map(([k, f]) => {
        if (compiled[k]) {
          return fs.writeFile(f, compiled[k]!, { encoding: 'utf8' });
        } else {
          return fs.unlink(f).catch(() => { }); // Remove file if data not provided
        }
      }));

    return compiled;
  }

  /**
   * Compile template
   */
  static async compile(tpl: string, root: string): Promise<Compilation> {
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
}