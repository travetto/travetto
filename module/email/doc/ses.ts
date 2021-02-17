import { SESClient } from '@aws-sdk/client-ses';

import { InjectableFactory } from '@travetto/di';
import { NodemailerTransport } from '@travetto/email';

class Config {
  @InjectableFactory()
  static getTransport() {
    return new NodemailerTransport({
      SES: SESClient
    });
  }
}
