import { Inject } from '@travetto/di';

import { BaseTransport } from './base';
import { MailConfig } from '../../src/config';

export class SmtpTransport extends BaseTransport {
  @Inject()
  config: MailConfig;

  getTransport() {
    const smtpTransport = require('nodemailer-smtp-transport');
    return smtpTransport(this.config.transport);
  }
}