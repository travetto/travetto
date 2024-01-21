import { MailService, EmailOptions, SentEmail } from '@travetto/email';
import { MailTransportTarget } from '@travetto/email/src/internal/types';
import { DependencyRegistry } from '@travetto/di';

import { EditorConfig } from './config';
import { RuntimeIndex } from '@travetto/manifest';

/**
 * Util for sending emails
 */
export class EditorSendService {

  static #svc: Record<string, MailService> = {};

  /**
   * Get mail service
   */
  static async getMailService(file: string): Promise<MailService> {
    const mod = RuntimeIndex.getModuleFromSource(file)!.name;

    if (!this.#svc[mod]) {
      const senderConfig = await EditorConfig.get('sender');

      if (senderConfig.host?.includes('ethereal.email')) {
        const cls = class { };
        const { NodemailerTransport } = await import('@travetto/email-nodemailer');
        DependencyRegistry.registerFactory({
          fn: () => new NodemailerTransport(senderConfig),
          target: MailTransportTarget,
          src: cls,
          id: 'nodemailer',
        });

        DependencyRegistry.install(cls, { curr: cls, type: 'added' });
      } else if (!DependencyRegistry.getCandidateTypes(MailTransportTarget).length) {
        const errorMessage = `
Please configure your email setup and/or credentials for testing. In the file \`email/local.yml\`, you can specify \`sender\` configuration.
Email sending will not work until the above is fixed. A sample configuration would look like:     

${EditorConfig.getDefaultConfig()}`.trim();
        console.error(errorMessage);
        throw new Error(errorMessage);
      }

      this.#svc[mod] = await DependencyRegistry.getInstance(MailService);
    }
    return this.#svc[mod];
  }

  /**
   * Resolve template
   */
  static async sendEmail(file: string, message: EmailOptions): Promise<{
    url?: string | false;
  }> {
    const to = message.to!;
    try {
      console.log('Sending email', { to });
      // Let the engine template
      const svc = await this.getMailService(file);
      if (!svc) {
        throw new Error('Node mailer support is missing');
      }

      const info = await svc.send<{ host?: string } & SentEmail>(message);
      console.log('Sent email', { to });

      const senderConfig = await EditorConfig.get('sender');
      return senderConfig.host?.includes('ethereal.email') ? {
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions, @typescript-eslint/no-explicit-any
        url: (await import('nodemailer')).getTestMessageUrl(info as any)
      } : {};
    } catch (err) {
      console.warn('Failed to send email', { to, error: err });
      throw err;
    }
  }
}