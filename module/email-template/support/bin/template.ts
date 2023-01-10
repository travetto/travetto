import type { MailTemplateEngine } from '@travetto/email';
import { WatchUtil, TimeUtil, TypedObject } from '@travetto/base';

import { EmailTemplateCompiler, Compilation } from '../../src/compiler';
import { EmailTemplateResource } from '../../src/resource';

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
  async watchCompile(cb?: (file: string) => void): Promise<void> {
    await WatchUtil.buildWatcher(this.resources.getAllPaths(), async ({ action, file }) => {
      if (action !== 'update') {
        return;
      }
      if (/[.]compiled[.]/.test(file) ||
        !/[.](html|scss|css|png|jpe?g|gif|ya?ml)$/.test(file)
      ) {
        return;
      }

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