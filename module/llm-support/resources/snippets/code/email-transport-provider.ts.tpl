import { Injectable } from '@travetto/di';

@Injectable()
export class EmailProvider {
  async send(to: string, subject: string, html: string): Promise<void> {
    console.log('email-send', { to, subject, size: html.length });
  }
}
