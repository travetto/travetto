import type * as SMTPTransport from 'nodemailer/lib/smtp-transport';

import { MailService } from '@travetto/email';
import { NodemailerTransport } from '@travetto/email-nodemailer';
import { MailTransportTarget } from '@travetto/email/src/internal/types';
import { DependencyRegistry } from '@travetto/di';

import { EditorConfig } from './config';

/**
 * Util for sending emails
 */
export class EditorSendService {

  #svc: MailService;

  /**
   * Get mail service
   */
  async getMailService(): Promise<MailService> {
    if (!this.#svc) {
      const senderConfig = await EditorConfig.getSenderConfig();

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

${EditorConfig.getDefaultConfig()}`.trim();
        console.error(errorMessage);
        throw new Error(errorMessage);
      }

      this.#svc = await DependencyRegistry.getInstance(MailService);
    }
    return this.#svc;
  }

  /**
   * Resolve template
   */
  async sendEmail(key: string, from: string, to: string, context: Record<string, unknown>): Promise<{
    url?: string | false;
  }> {
    try {
      console.log('Sending email', { to });
      // Let the engine template
      const svc = await this.getMailService();
      if (!svc) {
        throw new Error('Node mailer support is missing');
      }

      const info = await svc.sendCompiled<SMTPTransport.SentMessageInfo>(key, { to, context, from });
      console.log('Sent email', { to });

      const senderConfig = await EditorConfig.getSenderConfig();
      return senderConfig.host?.includes('ethereal') ? {
        url: (await import('nodemailer')).getTestMessageUrl(info)
      } : {};
    } catch (err) {
      console.warn('Failed to send email', { to, error: err });
      throw err;
    }
  }
}