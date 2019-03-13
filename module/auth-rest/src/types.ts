import { Identity, Principal } from '@travetto/auth';

export interface AuthRequestAdapter<U = { [key: string]: any }> {
  principal: Principal | undefined;
  principalDetails: U;
  logout(): Promise<void>;
  authenticate(providers: symbol[]): Promise<Identity | undefined>;
  updatePrincipalDetails(details: U): Promise<void>;
}