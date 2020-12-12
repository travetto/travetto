import { SendUtil } from './send';
import { TemplateUtil } from './util';
import { ConfigUtil } from './config';

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

  /**
   * Initialize context, and listeners
   */
  static async init() {
    TemplateUtil.watchCompile(f => this.renderFile(f));

    process.on('message', async (msg) => {
      switch (msg.type) {
        case 'configure': return process.send!({ type: 'configured', file: await ConfigUtil.ensureConfig() });
        case 'redraw': {
          await TemplateUtil.compileToDisk(msg.file);
          return this.renderFile(msg.file);
        }
        case 'send': {
          const to = msg.to || (await ConfigUtil.get()).to;
          try {
            await SendUtil.sendEmail(msg.file, to, await ConfigUtil.getContext());
            process.send!({ type: 'sent', to, file: msg.file });
          } catch (err) {
            process.send!({ type: 'sent-failed', message: err.message, stack: err.stack, to, file: msg.file });
          }
          break;
        }
      }
    });
  }
}