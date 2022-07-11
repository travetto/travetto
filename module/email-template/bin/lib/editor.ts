import { SendUtil } from './send';
import { TemplateUtil } from './util';
import { ConfigUtil } from './config';

type InboundMessage =
  { type: 'configure' } |
  { type: 'redraw', file: string } |
  { type: 'send', file: string, from?: string, to?: string };

type OutboundMessage =
  { type: 'configured', file: string } |
  { type: 'sent', to: string, file: string } |
  { type: 'sent-failed', message: string, stack: Error['stack'], to: string, file: string };

/**
 * Utils for interacting with editors
 */
export class EditorUtil {
  static LAST_FILE = '';

  static async renderFile(file: string) {
    file = TemplateUtil.TPL_EXT.test(file) ? file : this.LAST_FILE;
    if (file) {
      process.send!({
        type: 'changed',
        file,
        content: await TemplateUtil.resolveCompiledTemplate(
          file, await ConfigUtil.getContext()
        )
      });
    }
  }

  static response(response: OutboundMessage) {
    if (process.send) {
      process.send(response);
    }
  }

  /**
   * Initialize context, and listeners
   */
  static async init() {
    const { PhaseManager } = await import('@travetto/base');
    await PhaseManager.run('init');

    TemplateUtil.watchCompile(f => this.renderFile(f));

    process.on('message', async (msg: InboundMessage) => {
      switch (msg.type) {
        case 'configure': return this.response({ type: 'configured', file: await ConfigUtil.ensureConfig() });
        case 'redraw': {
          await TemplateUtil.compileToDisk(msg.file);
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
            this.response({ type: 'sent-failed', message: err.message, stack: err.stack, to, file: msg.file });
          }
          break;
        }
      }
    });
  }
}