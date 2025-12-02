import { Inject, Injectable } from '@travetto/di';
import { MailUtil, EmailCompiled, MailInterpolator } from '@travetto/email';
import { AppError, TypedObject } from '@travetto/runtime';

import { EditorSendService } from './send.ts';
import { EditorConfig } from './config.ts';
import { EditorRequest, EditorResponse } from './types.ts';

import { EmailCompiler } from '../../src/compiler.ts';

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

  async #renderTemplate(rel: string, context: Record<string, unknown>): Promise<EmailCompiled> {
    const p = await EmailCompiler.compile(rel);
    return TypedObject.fromEntries(
      await Promise.all(TypedObject.entries(p).map(([k, v]) => this.#interpolate(v, context).then((t) => [k, t])))
    );
  }

  async #renderFile(file: string): Promise<{ content: EmailCompiled, file: string }> {
    const content = await this.#renderTemplate(file, await EditorConfig.get('context'));
    return { content, file };
  }

  async #response<T>(operation: Promise<T>, success: (v: T) => EditorResponse, fail?: (error: Error) => EditorResponse): Promise<void> {
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
      throw new AppError('Unable to run email editor, missing ipc channel');
    }
    process.on('message', async (msg: EditorRequest) => {
      switch (msg.type) {
        case 'configure': {
          return await this.#response(EditorConfig.ensureConfig(), file => ({ type: 'configured', file }));
        }
        case 'compile': {
          return await this.#response(this.#renderFile(msg.file),
            result => ({ type: 'compiled', ...result }),
            error => ({ type: 'compiled-failed', message: error.message, stack: error.stack, file: msg.file })
          );
        }
        case 'send': {
          return await this.#response(
            this.sendFile(msg.file, msg.to),
            result => ({ type: 'sent', ...result }),
            error => ({ type: 'sent-failed', message: error.message, stack: error.stack, to: msg.to!, file: msg.file })
          );
        }
      }
    });

    process.send({ type: 'init' });

    for await (const file of EmailCompiler.watchCompile()) {
      await this.#response(this.#renderFile(file),
        response => ({ type: 'compiled', ...response }),
        error => ({ type: 'compiled-failed', message: error.message, stack: error.stack, file })
      );
    }
  }
}