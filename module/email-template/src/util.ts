import { promises as fs } from 'fs';

import * as path from '@travetto/path';
import { FileResourceProvider, Resources } from '@travetto/base';
import type { MailTemplateEngine } from '@travetto/email';
import { DependencyRegistry } from '@travetto/di';
import { MailTemplateEngineTarget } from '@travetto/email/src/internal/types';

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
    const provider = Resources.getProvider(FileResourceProvider);
    return Promise.all((await provider.query(f => this.TPL_EXT.test(f)))
      .sort()
      .map(async pth => ({
        path: (await provider.describe(pth)).path,
        key: pth.replace(this.TPL_EXT, '')
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
    const compiled = await this.compile(resolved, path.dirname(file));

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
    const engine = await DependencyRegistry.getInstance<MailTemplateEngine>(MailTemplateEngineTarget);
    const provider = Resources.getProvider(FileResourceProvider);

    // Wrap with body
    tpl = (await provider.read('email/wrapper.html')).replace('<!-- BODY -->', tpl);

    // Resolve mustache partials
    tpl = await engine.resolveNested(tpl);

    // Transform inky markup
    let html = Inky.render(tpl);

    // Get Subject
    const [, subject] = html.match(/<title>(.*?)<\/title>/) ?? [];

    // Apply styles
    html = await StyleUtil.applyStyling(html);

    // Inline Images
    html = await ImageUtil.inlineImageSource(html, rel => path.resolve(root, rel));

    // Generate text version
    const text = await MarkdownUtil.htmlToMarkdown(tpl);

    return { html, text, subject };
  }
}