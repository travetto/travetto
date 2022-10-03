import type * as SMTPTransport from 'nodemailer/lib/smtp-transport';

import type { MailService } from '@travetto/email/src/service';

import { CompileUtil } from '../../src/util';
import { ConfigUtil } from './config';

/**
 * Util for sending emails
 */
export class SendUtil {

  static #svc: Promise<MailService>;

  /**
   * Get mail service
   */
  static async getMailService(): Promise<MailService> {
    if (!this.#svc) {
      const { MailService: M } = await import('@travetto/email');
      const { NodemailerTransport } = await import('@travetto/email-nodemailer');
      const { MailTransportTarget } = await import('@travetto/email/src/internal/types');
      const { DependencyRegistry } = await import('@travetto/di');

      const senderConfig = await ConfigUtil.getSenderConfig();

      if (senderConfig) {
        const cls = class { };
        DependencyRegistry.registerFactory({
          fn: () => new NodemailerTransport(senderConfig),
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

      this.#svc = DependencyRegistry.getInstance(M);
    }
    return this.#svc;
  }

  /**
   * Resolve template
   */
  static async sendEmail(file: string, from: string, to: string, context: Record<string, unknown>): Promise<{
    url?: string | false;
  }> {
    try {
      console.log('Sending email', { to });
      // Let the engine template
      const svc = await this.getMailService();
      if (!svc) {
        throw new Error('Node mailer support is missing');
      }

      const key = file.replace(CompileUtil.TPL_EXT, '').replace(/^.*?\/resources\//, '/');
      const info = await svc.sendCompiled<SMTPTransport.SentMessageInfo>(key, { to, context, from });
      console.log('Sent email', { to });

      const senderConfig = await ConfigUtil.getSenderConfig();
      return senderConfig.host?.includes('ethereal') ? {
        url: (await import('nodemailer')).getTestMessageUrl(info)
      } : {};
    } catch (err) {
      console.warn('Failed to send email', { to, error: err });
      throw err;
    }
  }
}