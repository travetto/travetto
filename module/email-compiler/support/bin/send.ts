import { MailService, EmailOptions, MailTransport } from '@travetto/email';
import { DependencyRegistryIndex, Injectable } from '@travetto/di';
import { toConcrete } from '@travetto/runtime';
import { RegistryV2 } from '@travetto/registry';

import { EditorConfig } from './config.ts';

/**
 * Editor mail sender
 */
@Injectable()
export class EditorSendService {

  ethereal = false;

  async service(): Promise<MailService> {
    const MailTransportTarget = toConcrete<MailTransport>();

    const transports = DependencyRegistryIndex.getCandidates(MailTransportTarget);

    if (!transports.length) {
      try {
        const { NodemailerTransport } = await import('@travetto/email-nodemailer');
        const senderConfig = await EditorConfig.get('sender');
        const cls = class { };
        DependencyRegistryIndex.getForRegister(cls).register({
          factory: () => new NodemailerTransport(senderConfig),
          target: MailTransportTarget,
        });
        RegistryV2.process([{ type: 'added', curr: cls }]);

        this.ethereal = !!senderConfig.host?.includes('ethereal.email');
      } catch {
        console.error('A mail transport is currently needed to support sending emails.  Please install @travetto/email-nodemailer or any other compatible transport');
        throw new Error('A mail transport is currently needed to support sending emails.  Please install @travetto/email-nodemailer or any other compatible transport');
      }
    }
    return await DependencyRegistryIndex.getInstance(MailService);
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