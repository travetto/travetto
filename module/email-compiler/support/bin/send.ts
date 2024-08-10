import { MailService, EmailOptions } from '@travetto/email';
import { MailTransportTarget } from '@travetto/email/src/internal/types';
import { DependencyRegistry, Injectable } from '@travetto/di';

import { EditorConfig } from './config';

/**
 * Editor mail sender
 */
@Injectable()
export class EditorSendService {

  ethereal = false;

  async service(): Promise<MailService> {
    const transports = DependencyRegistry.getCandidateTypes(MailTransportTarget);

    if (!transports.length) {
      try {
        const { NodemailerTransport } = await import('@travetto/email-nodemailer');
        const senderConfig = await EditorConfig.get('sender');
        const cls = class { };
        DependencyRegistry.registerFactory({
          fn: () => new NodemailerTransport(senderConfig),
          target: MailTransportTarget,
          src: cls,
          id: 'nodemailer',
        });
        DependencyRegistry.install(cls, { curr: cls, type: 'added' });

        this.ethereal = !!senderConfig.host?.includes('ethereal.email');
      } catch {
        console.error('A mail transport is currently needed to support sending emails.  Please install @travetto/email-nodemailer or any other compatible transport');
        throw new Error('A mail transport is currently needed to support sending emails.  Please install @travetto/email-nodemailer or any other compatible transport');
      }
    }
    return await DependencyRegistry.getInstance(MailService);
  }

  /**
   * Send email
   */
  async send(message: EmailOptions): Promise<{ url?: string | false }> {
    const to = message.to!;
    try {
      console.log('Sending email', { to });
      const svc = await this.service();
      if (this.ethereal) {
        const { getTestMessageUrl } = await import('nodemailer');
        const { default: _smtp } = await import('nodemailer/lib/smtp-transport/index');
        type SendMessage = Parameters<Parameters<(typeof _smtp)['prototype']['send']>[1]>[1];
        const info = await svc.send<SendMessage>(message);
        const url = getTestMessageUrl(info);
        console.log('Sent email', { to, url });
        return { url };
      } else {
        await svc.send(message);
        console.log('Sent email', { to });
        return {};
      }
    } catch (err) {
      console.warn('Failed to send email', { to, error: err });
      throw err;
    }
  }
}