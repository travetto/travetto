import * as travettoMail from '@travetto/email';
import { User } from '../model/user';
import { Injectable } from '@travetto/di';

@Injectable()
export class EmailService {
  sendEmail: travettoMail.EmailService['sendEmail'];

  constructor(private email: travettoMail.EmailService) {
    this.sendEmail = email.sendEmail.bind(email);
  }

  async sendUserEmail(user: User, subject: string, template: string, context: any) {
    context.user = user;
    return await this.email.sendEmail({
      to: `"${user.firstName} ${user.lastName}" <${user.email}>`,
      subject,
      template,
      context
    });
  }
}
