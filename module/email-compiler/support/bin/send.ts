import { MailService, MessageOptions, SentMessage } from '@travetto/email';
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

      if (senderConfig?.host?.includes('ethereal.email')) {
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
  async sendEmail(message: MessageOptions): Promise<{
    url?: string | false;
  }> {
    const to = message.to!;
    try {
      console.log('Sending email', { to });
      // Let the engine template
      const svc = await this.getMailService();
      if (!svc) {
        throw new Error('Node mailer support is missing');
      }

      const info = await svc.send<{ host?: string } & SentMessage>(message);
      console.log('Sent email', { to });

      const senderConfig = await EditorConfig.getSenderConfig();
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