import { Inject } from '@travetto/di';

import { BaseTransport } from './base';
import { MailConfig } from '../../src/config';

export class SesTransport extends BaseTransport {
  @Inject()
  config: MailConfig;

  getTransport() {
    const sesTransport = require('nodemailer-ses-transport');
    return sesTransport(this.config.transport);
  }
}