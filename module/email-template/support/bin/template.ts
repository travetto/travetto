import type { MailTemplateEngine, MessageCompiled } from '@travetto/email';
import { TypedObject } from '@travetto/base';
import { DependencyRegistry } from '@travetto/di';
import { MailTemplateEngineTarget } from '@travetto/email/src/internal/types';

import type { EmailTemplateCompiler } from '../../src/compiler';
import type { EmailTemplateResource } from '../../src/resource';

const VALID_FILE = (file: string): boolean => /[.](html|scss|css|png|jpe?g|gif|ya?ml)$/.test(file) && !/[.]compiled[.]/.test(file);

/**
 *
 */
export class TemplateManager {

  static async createInstance(): Promise<TemplateManager> {
    const { EmailTemplateCompiler: Compiler } = await import('../../src/compiler.js');
    const { EmailTemplateResource: Res } = await import('../../src/resource.js');

    return new TemplateManager(
      await DependencyRegistry.getInstance<MailTemplateEngine>(MailTemplateEngineTarget),
      new Compiler(new Res())
    );
  }

  compiler: EmailTemplateCompiler;
  engine: MailTemplateEngine;

  constructor(engine: MailTemplateEngine, compiler: EmailTemplateCompiler) {
    this.engine = engine;
    this.compiler = compiler;
  }

  get resources(): EmailTemplateResource {
    return this.compiler.resources;
  }

  /**
   * Resolve template
   */
  async resolveTemplateParts(file: string): Promise<MessageCompiled> {
    const files = this.resources.getOutputs(file);
    const missing = await Promise.all(Object.values(files).map(x => this.resources.describe(x).catch(() => { })));

    if (missing.some(x => x === undefined)) {
      await this.compiler.compile(file, true);
    }

    const parts = await Promise.all(
      TypedObject.entries(files).map(
        ([key, subRel]) => this.resources.read(subRel)
          .then(content => [key, content] as const)
      )
    );
    return TypedObject.fromEntries<keyof MessageCompiled, string>(parts);
  }

  /**
   * Render
   * @param rel
   */
  async resolveCompiledTemplate(rel: string, context: Record<string, unknown>): Promise<MessageCompiled> {
    const { html, text, subject } = await this.resolveTemplateParts(rel);

    return {
      html: await this.engine.template(html, context),
      text: await this.engine.template(text, context),
      subject: await this.engine.template(subject, context),
    };
  }

  /**
   * Watch compilation
   */
  async * watchCompile(): AsyncIterable<string> {
    const stream = this.resources.watchFiles();
    for await (const { file, action } of stream) {
      if (action === 'delete' || !VALID_FILE(file)) {
        continue;
      }

      try {
        if (this.resources.isTemplateFile(file)) {
          await this.compiler.compile(file, true);
          yield file;
        } else {
          await this.compiler.compileAll(true);
          for (const el of await this.resources.findAllTemplates()) {
            yield el.file!;
          }
        }
      } catch (err) {
        console.error(`Error in compiling ${file}`, err && err instanceof Error ? err.message : `${err}`);
      }
    }
  }
}