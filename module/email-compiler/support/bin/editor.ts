import { Inject, Injectable } from '@travetto/di';
import { MailUtil, EmailCompiled, MailInterpolator } from '@travetto/email';
import { AppError, TypedObject } from '@travetto/base';

import { EditorSendService } from './send';
import { EditorConfig } from './config';

import { EmailCompiler } from '../../src/compiler';

type InboundMessage =
  { type: 'configure', file: string } |
  { type: 'redraw', file: string } |
  { type: 'send', file: string, from?: string, to?: string };

type OutboundMessage =
  { type: 'configured', file: string } |
  { type: 'sent', to: string, file: string, url?: string | false } |
  { type: 'changed', file: string, content: Record<'html' | 'subject' | 'text', string> } |
  { type: 'sent-failed', message: string, stack: Error['stack'], to: string, file: string } |
  { type: 'changed-failed', message: string, stack: Error['stack'], file: string };

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

  async #response<T>(op: Promise<T>, success: (v: T) => OutboundMessage, fail?: (err: Error) => OutboundMessage): Promise<void> {
    try {
      const res = await op;
      if (process.connected) { process.send?.(success(res)); }
    } catch (err) {
      if (fail && process.connected && err && err instanceof Error) {
        process.send?.(fail(err));
      } else {
        console.error(err);
      }
    }
  }

  async sendFile(file: string, to?: string): Promise<{ to: string, file: string, url?: string | false | undefined }> {
    const cfg = await EditorConfig.get();
    to ||= cfg.to;
    const content = await this.#renderTemplate(file, cfg.context ?? {});
    return { to, file, ...await this.sender.send({ from: cfg.from, to, ...content, }) };
  }

  /**
   * Initialize context, and listeners
   */
  async listen(): Promise<void> {
    if (!process.connected || !process.send) {
      throw new AppError('Unable to run email editor, missing ipc channel', 'permissions');
    }
    process.on('message', async (msg: InboundMessage) => {
      switch (msg.type) {
        case 'configure': {
          return await this.#response(EditorConfig.ensureConfig(), file => ({ type: 'configured', file }));
        }
        case 'redraw': {
          return await this.#response(this.#renderFile(msg.file),
            res => ({ type: 'changed', ...res }),
            err => ({ type: 'changed-failed', message: err.message, stack: err.stack, file: msg.file })
          );
        }
        case 'send': {
          return await this.#response(
            this.sendFile(msg.file, msg.to),
            res => ({ type: 'sent', ...res }),
            err => ({ type: 'sent-failed', message: err.message, stack: err.stack, to: msg.to!, file: msg.file })
          );
        }
      }
    });

    process.once('disconnect', () => process.exit());
    process.send({ type: 'init' });

    for await (const file of EmailCompiler.watchCompile()) {
      await this.#response(this.#renderFile(file),
        res => ({ type: 'changed', ...res }),
        err => ({ type: 'changed-failed', message: err.message, stack: err.stack, file })
      );
    }
  }
}