import { Identity, Principal } from '@travetto/auth';

export interface AuthRequestAdapter {
  principal: Principal | undefined;
  logout(): Promise<void>;
  updatePrincipalDetails(details: { [key: string]: any }): Promise<void>;
  authenticate(providers: symbol[]): Promise<Identity | undefined>;
}