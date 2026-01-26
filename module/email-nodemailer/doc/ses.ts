import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2';

import { InjectableFactory } from '@travetto/di';
import { NodemailerTransport } from '@travetto/email-nodemailer';

class Config {
  @InjectableFactory()
  static getTransport() {
    return new NodemailerTransport({
      SES: {
        sesClient: new SESv2Client(),
        SendEmailCommand
      },
    });
  }
}
