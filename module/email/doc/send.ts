import { Inject, Injectable } from '@travetto/di';
import type { EmailOptions, MailService } from '@travetto/email';
import { RuntimeError } from '@travetto/runtime';

export interface UserNotificationRequest {
  recipientEmail: string;
  recipientName: string;
  subject: string;
  messageBody: string;
}

@Injectable()
export class NotificationDispatchService {
  @Inject()
  mailService: MailService;

  async sendTransactionalNotification(request: UserNotificationRequest): Promise<{ success: boolean; messageId?: string }> {
    const emailOptions: EmailOptions = {
      to: `${request.recipientName} <${request.recipientEmail}>`,
      subject: request.subject,
      text: request.messageBody,
      html: `<h2>Hello ${request.recipientName}</h2><p>${request.messageBody}</p>`
    };

    try {
      const response = await this.mailService.send(emailOptions);
      return { success: true, messageId: response?.messageId };
    } catch (err) {
      throw new RuntimeError(`Failed to dispatch email to ${request.recipientEmail}`, { category: 'general', cause: err });
    }
  }
}
