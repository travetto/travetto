import { defineGlobalEnv } from '@travetto/base';
import { RootIndex } from '@travetto/manifest';
import { RootRegistry } from '@travetto/registry';
import { DependencyRegistry } from '@travetto/di';
import { MailTemplateEngine } from '@travetto/email';
import { MailTemplateEngineTarget } from '@travetto/email/src/internal/types';

import { TemplateManager } from './template';
import { EditorSendService } from './send';
import { EditorConfig } from './config';

import { EmailTemplateResource } from '../../src/resource';
import { EmailTemplateCompiler } from '../../src/compiler';

type InboundMessage =
  { type: 'configure' } |
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
export class EditorState {

  static async init(): Promise<EditorState> {
    const editor = new EditorState(new TemplateManager(
      await DependencyRegistry.getInstance<MailTemplateEngine>(MailTemplateEngineTarget),
      new EmailTemplateCompiler(new EmailTemplateResource())
    ));
    await editor.init();
    return editor;
  }

  #lastFile = '';
  #sender: EditorSendService;
  #template: TemplateManager;

  constructor(template: TemplateManager) {
    this.#template = template;
    this.#sender = new EditorSendService();
  }

  async renderFile(file: string): Promise<void> {
    file = this.#template.resources.isTemplateFile(file) ? file : this.#lastFile;
    if (file) {
      try {
        const content = await this.#template.resolveCompiledTemplate(
          file, await EditorConfig.getContext()
        );
        this.response({
          type: 'changed',
          file,
          content
        });
      } catch (err) {
        if (err && err instanceof Error) {
          this.response({ type: 'changed-failed', message: err.message, stack: err.stack, file });
        } else {
          console.error(err);
        }
      }
    }
  }

  response(response: OutboundMessage): void {
    if (process.send) {
      process.send(response);
    }
  }

  async #onConfigure(msg: InboundMessage & { type: 'configure' }): Promise<void> {
    this.response({ type: 'configured', file: await EditorConfig.ensureConfig() });
  }

  async #onRedraw(msg: InboundMessage & { type: 'redraw' }): Promise<void> {
    try {
      await this.#template.compiler.compile(msg.file, true);
      await this.renderFile(msg.file);
    } catch (err) {
      if (err && err instanceof Error) {
        this.response({ type: 'changed-failed', message: err.message, stack: err.stack, file: msg.file });
      } else {
        console.error(err);
      }
    }
  }

  async #onSend(msg: InboundMessage & { type: 'send' }): Promise<void> {
    const cfg = await EditorConfig.get();
    const to = msg.to || cfg.to;
    const from = msg.from || cfg.from;
    const key = msg.file.replace(EmailTemplateResource.EXT, '');
    try {
      const url = await this.#sender.sendEmail(key, from, to, await EditorConfig.getContext());
      this.response({ type: 'sent', to, file: msg.file, ...url });
    } catch (err) {
      if (err && err instanceof Error) {
        this.response({ type: 'sent-failed', message: err.message, stack: err.stack, to, file: msg.file });
      } else {
        console.error(err);
      }
    }
  }

  /**
   * Initialize context, and listeners
   */
  async init(): Promise<void> {
    process.on('message', (msg: InboundMessage) => {
      if ('file' in msg) {
        msg.file = msg.file.replace(EmailTemplateResource.PATH_PREFIX, '');
      }
      switch (msg.type) {
        case 'configure': this.#onConfigure(msg); break;
        case 'redraw': this.#onRedraw(msg); break;
        case 'send': this.#onSend(msg); break;
      }
    });
    await this.#template.watchCompile(f => this.renderFile(f));
  }
}

export async function main(): Promise<void> {
  defineGlobalEnv({
    resourcePaths: [`${RootIndex.getModule('@travetto/email-template')!.sourcePath}/resources/email`]
  });

  await RootRegistry.init();
  await EditorState.init();
}