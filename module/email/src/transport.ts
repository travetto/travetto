import { EmailOptions, SentEmail } from './types.ts';

/**
 * Default mail transport
 *
 * @concrete ./internal/types#MailTransportTarget
 */
export interface MailTransport {
  send<S extends SentEmail = SentEmail>(mail: EmailOptions): Promise<S>;
}

/**
 * Transport that consumes messages without sending
 */
export class NullTransport implements MailTransport {
  async send<S extends SentEmail = SentEmail>(mail: EmailOptions): Promise<S> {
    return undefined! ?? {};
  }
}