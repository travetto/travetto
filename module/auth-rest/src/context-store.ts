import { AuthContext } from '@travetto/auth';
import { Response, Request } from '@travetto/rest';

export abstract class AuthContextStore<U = any> {

  abstract store(request: Request, response: Response, context: AuthContext<U>): Promise<void>;
  abstract load(request: Request): Promise<AuthContext<U> | undefined>;
  abstract clear(request: Request): Promise<void>;

  async refresh(request: Request, response: Response, context: AuthContext): Promise<void> {
    await this.store(request, response, context);
  }
}

export class SessionAuthContextStore extends AuthContextStore {

  async store(request: Request, response: Response, context: AuthContext): Promise<void> {
    request.session.context = context;
  }

  async load(request: Request): Promise<AuthContext | undefined> {
    return request.session.context;
  }

  async clear(request: Request) {
    delete request.session.context;
  }
}