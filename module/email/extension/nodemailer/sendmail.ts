import { Inject } from '@travetto/di';

import { BaseTransport } from './base';
import { MailConfig } from '../../src/config';

export class SendmailTransport extends BaseTransport {
  @Inject()
  config: MailConfig;

  getTransport() {
    const sendmailTransport = require('nodemailer-sendmail-transport');
    return sendmailTransport({
      path: '/usr/sbin/sendmail',
      ...this.config.transport
    });
  }
}