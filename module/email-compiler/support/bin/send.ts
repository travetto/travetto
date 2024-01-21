import { MailService, EmailOptions, SentEmail } from '@travetto/email';
import { MailTransportTarget } from '@travetto/email/src/internal/types';
import { DependencyRegistry, Injectable } from '@travetto/di';

import { EditorConfig } from './config';

/**
 * Editor mail sender
 */
@Injectable()
export class EditorSendService {

  service: MailService;

  async postConstruct(): Promise<void> {
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

    this.service = await DependencyRegistry.getInstance(MailService);
  }

  /**
   * Send email
   */
  async send(message: EmailOptions): Promise<{ url?: string | false }> {
    const to = message.to!;
    try {
      console.log('Sending email', { to });
      const info = await this.service.send<{ host?: string } & SentEmail>(message);
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