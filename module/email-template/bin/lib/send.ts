import { MailService } from '@travetto/email/src/service';
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
      const { MailService: M, NodemailerTransport } = await import('@travetto/email');
      const { MailTransportTarget } = await import('@travetto/email/src/internal/types');
      const { DependencyRegistry } = await import('@travetto/di');

      const senderConfig = await ConfigUtil.getSenderConfig();

      if (senderConfig) {
        const cls = class { };
        DependencyRegistry.registerFactory({
          fn: () => new NodemailerTransport(senderConfig as ConstructorParameters<typeof NodemailerTransport>[0]),
          target: MailTransportTarget,
          src: cls,
          id: 'nodemailer',
        });

        DependencyRegistry.install(cls, { curr: cls, type: 'added' });
      } else if (!DependencyRegistry.getCandidateTypes(MailTransportTarget).length) {
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
  static async sendEmail(file: string, to: string, context: Record<string, unknown>) {
    try {
      console.log('Sending email', { to });
      // Let the engine template
      const svc = await this.getMailService();
      if (!svc) {
        throw new Error('Node mailer support is missing');
      }

      const key = file.replace(TemplateUtil.TPL_EXT, '').replace(/^.*?\/resources\//, '/');
      const info = await svc.sendCompiled(key, { to, context });
      console.log('Sent email', { to });

      const senderConfig = await ConfigUtil.getSenderConfig();
      return senderConfig.host?.includes('ethereal') ? { url: require('nodemailer').getTestMessageUrl(info) } : {};
    } catch (e) {
      console.warn('Failed to send email', { to, error: e as Error });
      throw e;
    }
  }
}