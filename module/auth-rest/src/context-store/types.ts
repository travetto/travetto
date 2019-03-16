import { AuthContext } from '@travetto/auth';
import { Response, Request } from '@travetto/rest';

export abstract class AuthContextStore<U = any> {

  abstract store(request: Request, response: Response, context: AuthContext<U>): Promise<void>;
  abstract load(request: Request): Promise<AuthContext<U> | undefined>;

  refresh?(request: Request, response: Response, context: AuthContext<U>): Promise<void>;
}