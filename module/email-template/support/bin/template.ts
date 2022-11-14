import { FilePresenceManager } from '@travetto/watch';
import type { MailTemplateEngine } from '@travetto/email';
import { TimeUtil } from '@travetto/base';

import { EmailTemplateCompiler, Compilation } from '../../src/compiler';

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

  get resources() {
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
      Object.entries(files).map(
        ([key, subRel]) => this.resources.read(subRel)
          .then(content => [key, content] as [keyof Compilation, string])
      )
    );
    return Object.fromEntries<keyof Compilation, string>(parts);
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
  async watchCompile(cb?: (file: string) => void): Promise<void> {
    new FilePresenceManager(this.resources.getAllPaths(), {
      ignoreInitial: true,
      validFile: x =>
        !/[.]compiled[.]/.test(x) && (
          /[.](html|scss|css|png|jpe?g|gif|ya?ml)$/.test(x)
        )
    }).on('changed', async ({ file }) => {
      try {
        console.log('Contents changed', { file });
        if (this.resources.isTemplateFile(file)) {
          await this.compiler.compile(file.replace(/^.*\/resources\//g, ''), true);
          cb?.(file);
        } else {
          await this.compiler.compileAll(true);
          if (cb) {
            for (const el of await this.resources.findAllTemplates()) {
              cb(el.path);
            }
          }
        }
      } catch (err) {
        console.error(`Error in compiling ${file}`, err && err instanceof Error ? err.message : `${err}`);
      }
    });
    await TimeUtil.wait('1d');
  }
}