import fs from 'node:fs/promises';

import { type MailInterpolator, type EmailCompiled } from '@travetto/email';
import { Inject, Injectable } from '@travetto/di';
import { TypedObject } from '@travetto/base';

import { EmailCompiler } from '../../src/compiler';

/**
 *
 */
@Injectable()
export class EmailCompilationManager {

  @Inject()
  engine: MailInterpolator;

  /**
   * Resolve template
   */
  async resolveTemplateParts(file: string): Promise<EmailCompiled> {
    const files = EmailCompiler.getOutputFiles(file);
    const missing = await Promise.all(Object.values(files).map(x => fs.stat(file).catch(() => { })));

    if (missing.some(x => x === undefined)) {
      await EmailCompiler.compile(file, true);
    }

    const parts = await Promise.all(
      TypedObject.entries(files).map(
        ([key, partFile]) => fs.readFile(partFile, 'utf8')
          .then(content => [key, content] as const)
      )
    );
    return TypedObject.fromEntries<keyof EmailCompiled, string>(parts);
  }

  /**
   * Render
   * @param rel
   */
  async resolveCompiledTemplate(rel: string, context: Record<string, unknown>): Promise<EmailCompiled> {
    const { MailUtil } = await import('@travetto/email');
    const { html, text, subject } = await this.resolveTemplateParts(rel);

    const get = (input: string): Promise<string> =>
      Promise.resolve(this.engine.render(input, context)).then(MailUtil.purgeBrand);

    return { html: await get(html), text: await get(text), subject: await get(subject) };
  }
}