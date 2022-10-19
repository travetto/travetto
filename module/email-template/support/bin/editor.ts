import { TemplateUtil } from './util';
import { SendUtil } from './send';
import { EditorConfig } from './config';

type InboundMessage =
  { type: 'configure' } |
  { type: 'redraw', file: string } |
  { type: 'send', file: string, from?: string, to?: string };

type OutboundMessage =
  { type: 'configured', file: string } |
  { type: 'sent', to: string, file: string } |
  { type: 'changed', file: string, content: Record<'html' | 'subject' | 'text', string> } |
  { type: 'sent-failed', message: string, stack: Error['stack'], to: string, file: string } |
  { type: 'changed-failed', message: string, stack: Error['stack'], file: string };

/**
 * Utils for interacting with editors
 */
class $EditorState {
  #lastFile = '';

  async renderFile(file: string): Promise<void> {
    const { CompileUtil } = await import('../../src/util');
    file = CompileUtil.TPL_EXT.test(file) ? file : this.#lastFile;
    if (file) {
      try {
        const content = await TemplateUtil.resolveCompiledTemplate(
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
      const { CompileUtil } = await import('../../src/util');
      await CompileUtil.compileToDisk(msg.file);
    } catch (err) {
      if (err && err instanceof Error) {
        this.response({ type: 'changed-failed', message: err.message, stack: err.stack, file: msg.file });
      } else {
        console.error(err);
      }
    }
    await this.renderFile(msg.file);
  }

  async #onSend(msg: InboundMessage & { type: 'send' }): Promise<void> {
    const cfg = await EditorConfig.get();
    const to = msg.to || cfg.to;
    const from = msg.from || cfg.from;
    try {
      await SendUtil.sendEmail(msg.file, from, to, await EditorConfig.getContext());
      this.response({ type: 'sent', to, file: msg.file });
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
    const { PhaseManager } = await import('@travetto/base');
    await PhaseManager.run('init');

    TemplateUtil.watchCompile(f => this.renderFile(f));

    process.on('message', (msg: InboundMessage) => {
      switch (msg.type) {
        case 'configure': this.#onConfigure(msg); break;
        case 'redraw': this.#onRedraw(msg); break;
        case 'send': this.#onSend(msg); break;
      }
    });
  }
}

export const EditorState = new $EditorState();