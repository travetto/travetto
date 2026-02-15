import { Inject, Injectable } from '@travetto/di';
import { MailUtil, type EmailCompiled, type MailInterpolator } from '@travetto/email';
import { RuntimeError, TypedObject, WatchUtil } from '@travetto/runtime';

import type { EditorSendService } from './send.ts';
import { EditorConfig } from './config.ts';
import type { EditorRequest, EditorResponse } from './types.ts';

import { EmailCompiler } from '../../src/compiler.ts';
import { EmailCompileUtil } from '../../src/util.ts';

/**
 * Utils for interacting with editors
 */
@Injectable()
export class EditorService {

  @Inject()
  sender: EditorSendService;

  @Inject()
  engine: MailInterpolator;

  async #interpolate(text: string, context: Record<string, unknown>): Promise<string> {
    return Promise.resolve(this.engine.render(text, context)).then(MailUtil.purgeBrand);
  }

  async #renderTemplate(templateFile: string, context: Record<string, unknown>): Promise<EmailCompiled> {
    const email = await EmailCompiler.compile(templateFile);
    return TypedObject.fromEntries(
      await Promise.all(TypedObject.entries(email).map(([key, value]) =>
        this.#interpolate(value, context).then((result) => [key, result])))
    );
  }

  async #renderFile(file: string): Promise<{ content: EmailCompiled, file: string }> {
    const content = await this.#renderTemplate(file, await EditorConfig.get('context'));
    return { content, file };
  }

  async #response<T>(operation: Promise<T>, success: (value: T) => EditorResponse, fail?: (error: Error) => EditorResponse): Promise<void> {
    try {
      const response = await operation;
      if (process.connected) { process.send?.(success(response)); }
    } catch (error) {
      if (fail && process.connected && error && error instanceof Error) {
        process.send?.(fail(error));
      } else {
        console.error(error);
      }
    }
  }

  async sendFile(file: string, to?: string): Promise<{ to: string, file: string, url?: string | false | undefined }> {
    const config = await EditorConfig.get();
    to ||= config.to;
    const content = await this.#renderTemplate(file, config.context ?? {});
    return { to, file, ...await this.sender.send({ from: config.from, to, ...content, }) };
  }

  /**
   * Initialize context, and listeners
   */
  async listen(): Promise<void> {
    if (!process.connected || !process.send) {
      throw new RuntimeError('Unable to run email editor, missing ipc channel');
    }
    process.on('message', async (request: EditorRequest) => {
      switch (request.type) {
        case 'configure': {
          return await this.#response(EditorConfig.ensureConfig(), file => ({ type: 'configured', file }));
        }
        case 'compile': {
          return await this.#response(this.#renderFile(request.file),
            result => ({ type: 'compiled', ...result }),
            error => ({ type: 'compiled-failed', message: error.message, stack: error.stack, file: request.file })
          );
        }
        case 'send': {
          return await this.#response(
            this.sendFile(request.file, request.to),
            result => ({ type: 'sent', ...result }),
            error => ({ type: 'sent-failed', message: error.message, stack: error.stack, to: request.to!, file: request.file })
          );
        }
      }
    });

    process.send({ type: 'init' });

    await WatchUtil.watchCompilerEvents('change',
      ({ file }) => EmailCompiler.spawnCompile(file).then(success =>
        success ? this.#response(this.#renderFile(file),
          result => ({ type: 'compiled', ...result }),
          error => ({ type: 'compiled-failed', message: error.message, stack: error.stack, file })
        ) : undefined
      ),
      ({ file }) => EmailCompileUtil.isTemplateFile(file));
  }
}