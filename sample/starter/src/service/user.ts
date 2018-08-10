import { ModelService } from '@travetto/model';
import { User } from '../model/user';
import { AppConfig } from '../config';
import { Injectable, Inject } from '@travetto/di';
import { EmailService } from './email';
import { AuthModelService } from '@travetto/auth-model';
import { AuthService } from '@travetto/auth';

@Injectable()
export class UserService {

  @Inject() config: AppConfig;
  @Inject() strategy: AuthModelService<User>;
  @Inject() email: EmailService;
  @Inject() model: ModelService;
  @Inject() auth: AuthService;

  async get(userId: string) {
    const user = await this.model.getById(User, userId);
    return user;
  }

  getActiveUser() {
    return this.auth.context.principal as User;
  }

  getActiveUserId() {
    return this.getActiveUser().id;
  }

  getActiveUseAccesType() {
    return this.getActiveUser().accessType;
  }

  async register(user: User) {
    user = await this.strategy.register(user);

    await this.email.sendUserEmail(user, 'Welcome to Sample App', `
    Welcome ${user.firstName},

    You are now signed up!
        `, {});
    return user;
  }

  async changePassword(email: string, newPassword: string, oldPassword: string) {
    return await this.strategy.changePassword!(email, newPassword, oldPassword);
  }

  async resetPassword(email: string, newPassword: string, resetToken: string) {
    let user = await this.model.getByQuery(User, {
      where: {
        email,
        resetToken
      }
    });
    user = await this.strategy.changePassword!(email, newPassword, resetToken);
    // Clear token,
    // TODO: FIX
    // delete user.resetExpires;
    // delete user.resetToken;
    return await this.model.update(User, user);
  }

  async resetPasswordStart(email: string) {
    const user = await this.strategy.generateResetToken(email);
    await this.email.sendUserEmail(user, 'Password Reset for Sample App', `
Hi ${user.firstName},

Please follow click [reset password](${this.config.baseUrl}/auth/reset/${user.resetToken})!
    `, {});
    return;
  }
}