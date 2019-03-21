import { Identity, Principal, AuthContext } from '@travetto/auth';
import { Response, Request } from '@travetto/rest';

export interface AuthRequestAdapter<U = { [key: string]: any }> {
  principal: Principal | undefined;
  principalDetails: U;
  logout(): Promise<void>;
  authenticate(providers: symbol[]): Promise<Identity | undefined>;
  updatePrincipalDetails(details: U): Promise<void>;
}

export abstract class AuthContextStore<U = any> {

  abstract store(request: Request, response: Response, context: AuthContext<U>): Promise<void>;
  abstract load(request: Request): Promise<AuthContext<U> | undefined>;

  refresh?(request: Request, response: Response, context: AuthContext<U>): Promise<void>;
}