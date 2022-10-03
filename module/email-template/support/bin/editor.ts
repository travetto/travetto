import { TemplateUtil } from './util';
import { SendUtil } from './send';
import { ConfigUtil } from './config';

import { CompileUtil } from '../../src/util';

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
export class EditorUtil {
  static LAST_FILE = '';

  static async renderFile(file: string): Promise<void> {
    file = CompileUtil.TPL_EXT.test(file) ? file : this.LAST_FILE;
    if (file) {
      try {
        const content = await TemplateUtil.resolveCompiledTemplate(
          file, await ConfigUtil.getContext()
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

  static response(response: OutboundMessage): void {
    if (process.send) {
      process.send(response);
    }
  }

  /**
   * Initialize context, and listeners
   */
  static async init(): Promise<void> {
    const { PhaseManager } = await import('@travetto/base');
    await PhaseManager.run('init');

    TemplateUtil.watchCompile(f => this.renderFile(f));

    process.on('message', async (msg: InboundMessage) => {
      switch (msg.type) {
        case 'configure': return this.response({ type: 'configured', file: await ConfigUtil.ensureConfig() });
        case 'redraw': {
          try {
            await CompileUtil.compileToDisk(msg.file);
          } catch (err) {
            if (err && err instanceof Error) {
              this.response({ type: 'changed-failed', message: err.message, stack: err.stack, file: msg.file });
            } else {
              console.error(err);
            }
          }
          return this.renderFile(msg.file);
        }
        case 'send': {
          const cfg = await ConfigUtil.get();
          const to = msg.to || cfg.to;
          const from = msg.from || cfg.from;
          try {
            await SendUtil.sendEmail(msg.file, from, to, await ConfigUtil.getContext());
            this.response({ type: 'sent', to, file: msg.file });
          } catch (err) {
            if (err && err instanceof Error) {
              this.response({ type: 'sent-failed', message: err.message, stack: err.stack, to, file: msg.file });
            } else {
              console.error(err);
            }
          }
          break;
        }
      }
    });
  }
}