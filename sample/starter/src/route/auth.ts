import { Request, Response } from 'express';
import {
  Get, Post,
  Controller,
  Redirect,
  TypedRequest
} from '@travetto/express';
import { SchemaBody } from '@travetto/schema/extension/express';
import { Authenticate, Authenticated, Unauthenticated } from '@travetto/auth-express';
import { User } from '../model/user';
import { UserService } from '../service/user';
import { AUTH } from '../config';
import { AuthContext } from '@travetto/auth';

/**
 * User authentication, and registration
 */
@Controller('/auth')
class Auth {

  constructor(private userService: UserService) { }

  /**
   * User registration, ftw
   */
  @Unauthenticated()
  @Post('/register')
  @SchemaBody(User)
  async register(req: TypedRequest<User>, res: Response, next: Function): Promise<User> {
    const user = await this.userService.register(req.body);
    return user;
  }

  /**
   * Reset a user by email address
   * @param {String} email A valid email address
   */
  @Unauthenticated()
  @Post('/reset/:email')
  async resetPasswordStart(req: Request, res: Response, next: Function) {
    return await this.userService.resetPasswordStart(req.params.email);
  }

  /**
   * Begin password reset workflow
   */
  @Unauthenticated()
  @Post('/reset')
  async resetPassword(req: Request, res: Response, next: Function): Promise<User> {
    return await this.userService.resetPassword(req.body.email, req.body.password, req.body.token);
  }

  /**
   * Determine if user is logged in or not
   */
  @Get('/checkToken')
  async checkToken(req: Request): Promise<AuthContext<{ id: string }>> {
    if (req.auth.unauthenticated) {
      throw { message: 'You are not logged in', statusCode: 401 };
    }
    return req.auth.context;
  }

  /**
   * Terminate session
   */
  @Get('/logout')
  @Authenticated()
  async logout(req: Request): Promise<Redirect | {}> {
    await req.auth.logout();

    if ((req.headers.accept as any as string[] || []).includes('text/html')) {
      return new Redirect('/?message=Successfully Logged Out');
    } else {
      return { acknowledged: true };
    }
  }

  /**
   * Actually login
   */
  @Post('/login')
  @Unauthenticated()
  @Authenticate(AUTH)
  async login(req: Request): Promise<User> {
    return this.userService.getActiveUser();
  }
}