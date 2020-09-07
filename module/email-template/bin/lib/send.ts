import { MailService } from '@travetto/email/src/service';
import { Class } from '@travetto/registry';
import { TemplateUtil } from './util';
import { ConfigUtil } from './config';

/**
 * Util for sending emails
 */
export class SendUtil {

  private static _svc: Promise<MailService>;

  /**
   * Get mail service
   */
  static async getMailService() {
    if (!this._svc) {
      const { MailService: M, MailTransport, NodemailerTransport } = await import('@travetto/email');
      const { DependencyRegistry } = await import('@travetto/di');

      const senderConfig = await ConfigUtil.getSenderConfig();

      if (senderConfig) {
        const cls = class { };
        DependencyRegistry.registerFactory({
          fn: () => new NodemailerTransport(senderConfig as unknown as any),
          target: MailTransport as unknown as Class,
          src: cls,
          id: 'nodemailer',
        });

        DependencyRegistry.install(cls, { curr: cls, type: 'added' });
      } else if (!DependencyRegistry.getCandidateTypes(MailTransport as unknown as Class).length) {
        const errorMessage = `
Please configure your email setup and/or credentials for testing. In the file \`email/dev.yml\`, you can specify \`sender\` configuration.
Email sending will not work until the above is fixed. A sample configuration would look like:     

${ConfigUtil.getDefaultConfig()}`.trim();
        console.error(errorMessage);
        throw new Error(errorMessage);
      }

      this._svc = DependencyRegistry.getInstance(M);
    }
    return this._svc;
  }

  /**
   * Resolve template
   */
  static async sendEmail(file: string, to: string, context: Record<string, any>) {
    try {
      console.log(`Sending email to ${to}`);
      // Let the engine template
      const svc = await this.getMailService();
      if (!svc) {
        throw new Error('Node mailer support is missing');
      }

      const key = file.replace(TemplateUtil.TPL_EXT, '').replace(/^.*?\/resources\//, '/');
      const info = await svc.sendCompiled(key, { to, context });
      console.log(`Sent email to ${to}`);

      const senderConfig = await ConfigUtil.getSenderConfig();
      return senderConfig.host?.includes('ethereal') ? { url: require('nodemailer').getTestMessageUrl(info) } : {};
    } catch (e) {
      console.log(`Failed to send email to ${to}`, e.message);
      throw e;
    }
  }
}