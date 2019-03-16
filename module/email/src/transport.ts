import { MessageOptions, SentMessage } from './types';

export abstract class MailTransport {
  abstract sendMail(mail: MessageOptions): Promise<SentMessage>;
}

export class NullTransport extends MailTransport {
  async sendMail(mail: MessageOptions): Promise<SentMessage> {
    return {};
  }
}