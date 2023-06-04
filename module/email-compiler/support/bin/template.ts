import type { MailTemplateEngine, MessageCompiled } from '@travetto/email';
import { TypedObject } from '@travetto/base';
import { DependencyRegistry } from '@travetto/di';
import { RootIndex, WatchEvent, WatchStream } from '@travetto/manifest';

import { MailTemplateEngineTarget } from '@travetto/email/src/internal/types';
import { DynamicFileLoader } from '@travetto/base/src/internal/file-loader';

import type { EmailCompiler } from '../../src/compiler';
import type { EmailCompilerResource } from '../../src/resource';

const VALID_FILE = (file: string): boolean => /[.](scss|css|png|jpe?g|gif|ya?ml)$/.test(file) && !/[.]compiled[.]/.test(file);

/**
 *
 */
export class TemplateManager {

  static async createInstance(): Promise<TemplateManager> {
    const { EmailCompiler: Compiler } = await import('../../src/compiler.js');
    const { EmailCompilerResource: Res } = await import('../../src/resource.js');

    return new TemplateManager(
      await DependencyRegistry.getInstance<MailTemplateEngine>(MailTemplateEngineTarget),
      new Compiler(new Res())
    );
  }

  compiler: EmailCompiler;
  engine: MailTemplateEngine;

  constructor(engine: MailTemplateEngine, compiler: EmailCompiler) {
    this.engine = engine;
    this.compiler = compiler;
  }

  get resources(): EmailCompilerResource {
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
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const stream = this.resources.watchFiles() as (
      WatchStream & {
        add(item: WatchEvent | WatchEvent[]): void;
      }
    );
    DynamicFileLoader.onLoadEvent((ev) => {
      const src = RootIndex.getEntry(ev.file);
      if (src && this.resources.isTemplateFile(src.sourceFile)) {
        stream.add({ ...ev, file: src.sourceFile });
      }
    });
    for await (const { file, action } of stream) {
      if (action === 'delete') {
        continue;
      }

      try {
        if (this.resources.isTemplateFile(file)) {
          await this.compiler.compile(file, true);
          yield file;
        } else if (VALID_FILE(file)) {
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