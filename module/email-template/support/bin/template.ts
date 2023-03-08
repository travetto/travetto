import type { MailTemplateEngine } from '@travetto/email';
import { TypedObject } from '@travetto/base';

import { EmailTemplateCompiler, Compilation } from '../../src/compiler';
import { EmailTemplateResource } from '../../src/resource';

const VALID_FILE = (file: string): boolean => /[.](html|scss|css|png|jpe?g|gif|ya?ml)$/.test(file) && !/[.]compiled[.]/.test(file);

/**
 *
 */
export class TemplateManager {

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
  async resolveTemplateParts(rel: string): Promise<Compilation> {
    const files = this.resources.getOutputs(rel);
    const missing = await Promise.all(Object.values(files).map(x => this.resources.describe(x).catch(() => { })));

    if (missing.some(x => x === undefined)) {
      await this.compiler.compile(rel, true);
    }

    const parts = await Promise.all(
      TypedObject.entries(files).map(
        ([key, subRel]) => this.resources.read(subRel)
          .then(content => [key, content] as const)
      )
    );
    return TypedObject.fromEntries<keyof Compilation, string>(parts);
  }

  /**
   * Render
   * @param rel
   */
  async resolveCompiledTemplate(rel: string, context: Record<string, unknown>): Promise<Compilation> {
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
        const rel = file.replace(EmailTemplateResource.PATH_PREFIX, '');
        console.log(`Contents ${action}`, { file, rel });
        if (this.resources.isTemplateFile(rel)) {
          await this.compiler.compile(rel, true);
          yield rel;
        } else {
          await this.compiler.compileAll(true);
          for (const el of await this.resources.findAllTemplates()) {
            yield el.rel;
          }
        }
      } catch (err) {
        console.error(`Error in compiling ${file}`, err && err instanceof Error ? err.message : `${err}`);
      }
    }
  }
}