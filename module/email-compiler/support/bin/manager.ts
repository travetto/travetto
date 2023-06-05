import fs from 'fs/promises';

import type { MailTemplateEngine, MessageCompiled } from '@travetto/email';
import { DependencyRegistry } from '@travetto/di';
import { TypedObject } from '@travetto/base';
import { MailTemplateEngineTarget } from '@travetto/email/src/internal/types';

import { EmailCompiler } from '../../src/compiler';

/**
 *
 */
export class EmailCompilationManager {

  static async createInstance(): Promise<EmailCompilationManager> {
    return new EmailCompilationManager(
      await DependencyRegistry.getInstance<MailTemplateEngine>(MailTemplateEngineTarget),
    );
  }

  engine: MailTemplateEngine;

  constructor(engine: MailTemplateEngine) {
    this.engine = engine;
  }

  /**
   * Resolve template
   */
  async resolveTemplateParts(file: string): Promise<MessageCompiled> {
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

}