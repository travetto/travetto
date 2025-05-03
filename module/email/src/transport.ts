import { castTo } from '@travetto/runtime';
import { EmailOptions, SentEmail } from './types.ts';

/**
 * Default mail transport
 *
 * @concrete
 */
export interface MailTransport {
  send<S extends SentEmail = SentEmail>(mail: EmailOptions): Promise<S>;
}

/**
 * Transport that consumes messages without sending
 */
export class NullTransport implements MailTransport {
  async send<S extends SentEmail = SentEmail>(): Promise<S> {
    return castTo({});
  }
}