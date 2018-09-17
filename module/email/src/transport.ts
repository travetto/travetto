import { MailTransport, MessageOptions, SentMessage } from './types';

export class NullTransport extends MailTransport {
  async sendMail(mail: MessageOptions): Promise<SentMessage> {
    return {};
  }
}