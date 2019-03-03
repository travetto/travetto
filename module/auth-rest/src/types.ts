import { Identity } from '@travetto/auth';
import { Principal } from '../../auth/src/types';

export interface AuthRequestAdapter {
  principal: Principal | undefined;
  logout(): Promise<void>;
  updatePrincipalDetails(details: { [key: string]: any }): Promise<void>;
  authenticate(providers: symbol[]): Promise<Identity | undefined>;
}